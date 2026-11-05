import Capacitor
class PreviewViewController: CAPBridgeViewController {
 override func capacitorDidLoad() { bridge?.registerPluginInstance(PottyStorePlugin()) }
}
