import Foundation
import Capacitor
import StoreKit
import AuthenticationServices
import CryptoKit
import Security

@objc(PottyStorePlugin)
public class PottyStorePlugin: CAPPlugin, CAPBridgedPlugin, ASAuthorizationControllerDelegate, ASAuthorizationControllerPresentationContextProviding {
 public let identifier = "PottyStorePlugin"
 public let jsName = "PottyStore"
 public let pluginMethods: [CAPPluginMethod] = [
  CAPPluginMethod(name: "appleIdentity", returnType: CAPPluginReturnPromise),
  CAPPluginMethod(name: "purchase", returnType: CAPPluginReturnPromise),
  CAPPluginMethod(name: "recover", returnType: CAPPluginReturnPromise),
  CAPPluginMethod(name: "restore", returnType: CAPPluginReturnPromise),
  CAPPluginMethod(name: "finish", returnType: CAPPluginReturnPromise)
 ]
 private var authCall: CAPPluginCall?
 private var authNonce: String?
 private var appleController: ASAuthorizationController?
 @objc func appleIdentity(_ call: CAPPluginCall) {
  DispatchQueue.main.async {
   guard self.authCall == nil else {call.reject("Sign-in already in progress");return}
   guard self.bridge?.viewController?.view.window != nil else {call.reject("Please reopen the account screen");return}
   var bytes=[UInt8](repeating:0,count:32)
   guard SecRandomCopyBytes(kSecRandomDefault, bytes.count, &bytes)==errSecSuccess else {call.reject("Could not start sign-in");return}
   let nonce=bytes.map{String(format:"%02x",$0)}.joined()
   let request=ASAuthorizationAppleIDProvider().createRequest()
   request.requestedScopes=[.email];request.nonce=SHA256.hash(data:Data(nonce.utf8)).map{String(format:"%02x",$0)}.joined()
   self.authCall=call;self.authNonce=nonce
   let controller=ASAuthorizationController(authorizationRequests:[request]);self.appleController=controller
   controller.delegate=self;controller.presentationContextProvider=self;controller.performRequests()
  }
 }
 public func presentationAnchor(for controller: ASAuthorizationController) -> ASPresentationAnchor { bridge!.viewController!.view.window! }
 public func authorizationController(controller: ASAuthorizationController,didCompleteWithAuthorization auth: ASAuthorization) {
  defer{authCall=nil;authNonce=nil;appleController=nil}
  guard let c=auth.credential as? ASAuthorizationAppleIDCredential,let raw=c.identityToken,let token=String(data:raw,encoding:.utf8),let nonce=authNonce else {authCall?.reject("Apple did not return an identity");return}
  authCall?.resolve(["token":token,"nonce":nonce])
 }
 public func authorizationController(controller: ASAuthorizationController,didCompleteWithError error: Error) {
  authCall?.reject(error.localizedDescription);authCall=nil;authNonce=nil;appleController=nil
 }
 private var pending: [String: Transaction] = [:]
 @objc func purchase(_ call: CAPPluginCall) {
  guard let id=call.getString("productId"), let raw=call.getString("accountToken"), let account=UUID(uuidString: raw) else { call.reject("Save your account first"); return }
  Task { @MainActor in
   do {
    guard let product=try await Product.products(for:[id]).first else { call.reject("This product is not available in App Store Connect yet"); return }
    let result=try await product.purchase(options:[.appAccountToken(account)])
    switch result {
    case .success(let verification):
     guard case .verified(let tx)=verification else { call.reject("Apple could not verify the purchase"); return }
     self.pending[String(tx.id)]=tx
     call.resolve(["status":"purchased","signedTransaction":verification.jwsRepresentation,"transactionId":String(tx.id),"price":product.displayPrice])
    case .userCancelled: call.resolve(["status":"cancelled"])
    case .pending: call.resolve(["status":"pending"])
    @unknown default: call.reject("Purchase could not be completed")
    }
   } catch { call.reject(error.localizedDescription) }
  }
 }
 @objc func recover(_ call: CAPPluginCall) {
  Task { @MainActor in
   var values: [[String:String]]=[]
   for await r in Transaction.unfinished { if case .verified(let t)=r { self.pending[String(t.id)]=t;values.append(["signedTransaction":r.jwsRepresentation,"transactionId":String(t.id)]) } }
   call.resolve(["transactions":values])
  }
 }
 @objc func restore(_ call: CAPPluginCall) {
  Task { @MainActor in
   do {
    try await AppStore.sync()
    var values: [[String:String]]=[]
    var seen=Set<UInt64>()
    for await result in Transaction.unfinished {
     if case .verified(let tx)=result, seen.insert(tx.id).inserted {
      self.pending[String(tx.id)]=tx; values.append(["signedTransaction":result.jwsRepresentation,"transactionId":String(tx.id)])
     }
    }
    for await result in Transaction.currentEntitlements {
     if case .verified(let tx)=result, seen.insert(tx.id).inserted {
      self.pending[String(tx.id)]=tx; values.append(["signedTransaction":result.jwsRepresentation,"transactionId":String(tx.id)])
     }
    }
    call.resolve(["transactions":values])
   } catch { call.reject(error.localizedDescription) }
  }
 }
 @objc func finish(_ call: CAPPluginCall) {
  guard let id=call.getString("transactionId"), let tx=pending[id] else { call.reject("Transaction not loaded"); return }
  Task { @MainActor in await tx.finish(); self.pending.removeValue(forKey:id); call.resolve() }
 }
}
