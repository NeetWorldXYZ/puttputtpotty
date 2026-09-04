import { PlayView } from './game/PlayView';
import { GeneratedCourse } from './game/GeneratedCourse';
import { EditorView } from './editor/EditorView';
import { COURSE } from './holes';
import { navigate, useLocation } from './router';

export function App() {
  const loc = useLocation();
  if (loc.route === 'editor') return <EditorView onExit={() => navigate('play')} />;
  if (loc.seed) return <GeneratedCourse key={loc.seed} seed={loc.seed} onOpenEditor={() => navigate('editor')} />;
  return <PlayView holes={COURSE} onOpenEditor={() => navigate('editor')} />;
}
