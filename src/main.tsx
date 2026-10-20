import { render } from 'preact';
import './ui/styles/tokens.css';
import './ui/styles/base.css';
import { App } from './ui/app';

render(<App />, document.getElementById('app')!);
