import { PlayView } from './game/PlayView';
import { EditorView } from './editor/EditorView';
import { COURSE } from './holes';
import { navigate, useRoute } from './router';

export function App() {
  const route = useRoute();
  if (route === 'editor') return <EditorView onExit={() => navigate('play')} />;
  return <PlayView holes={COURSE} onOpenEditor={() => navigate('editor')} />;
}
