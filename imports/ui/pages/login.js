import { Template } from 'meteor/templating';
import { FlowRouter } from 'meteor/ostrio:flow-router-extra';

import './login.html';

Template.login.events({
	'submit form'(event) {
		event.preventDefault();
		if ($('#password').val() === 'vaS37avCbN2DEHUb3BNt65beEqqXP9HDbxPCxHLTcrXrbWXpc5KcSDL6caBLPUuC') {
			localStorage.setItem('key', 'vaS37avCbN2DEHUb3BNt65beEqqXP9HDbxPCxHLTcrXrbWXpc5KcSDL6caBLPUuC');
			FlowRouter.go('/');
		} else {
			$('#password').val('');
		}
	},
});
