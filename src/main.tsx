import '@fontsource/lato/400.css';
import '@fontsource/lato/400-italic.css';
import '@fontsource/lato/700.css';
import { render } from 'preact';
import './styles/tokens.css';
import './styles/base.css';
import { App } from './ui/App';
import { REPORT_CSS } from './ui/report';

// The drawer, print and the downloaded report share one stylesheet.
const reportStyle = document.createElement('style');
reportStyle.textContent = REPORT_CSS;
document.head.append(reportStyle);

render(<App />, document.getElementById('app')!);
