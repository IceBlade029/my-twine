import * as React from 'react';
import * as ReactDOM from 'react-dom';
import {App} from './app';
import {i18nReady} from './util/i18n';

i18nReady.then(() => {
	ReactDOM.render(
		<React.StrictMode>
			<App />
		</React.StrictMode>,
		document.getElementById('root')
	);
});
