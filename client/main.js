import jQuery from 'jquery';
window.$ = window.jQuery = jQuery;
document.title = 'Collaboration Explorer';

import { FlowRouter } from 'meteor/ostrio:flow-router-extra';
import { Projects } from '../imports/api/projects';

import '/imports/ui/layout.js';
import '/imports/ui/pages/loading.html';
import '/imports/ui/pages/notfound.html';

const authRoutes = FlowRouter.group({
	prefix: '',
	name: 'auth',
	triggersEnter: [
		(context, redirect) => {
			if (localStorage.getItem('key') !== 'vaS37avCbN2DEHUb3BNt65beEqqXP9HDbxPCxHLTcrXrbWXpc5KcSDL6caBLPUuC') redirect('/login');
		},
	],
});

FlowRouter.route('/login', {
	name: 'login',
	waitOn() {
		return [import('/imports/ui/pages/login.js')];
	},
	whileWaiting() {
		this.render('loading');
	},
	action() {
		this.render('login');
	},
});

authRoutes.route('/', {
	name: 'projects',
	waitOn() {
		return [import('/imports/ui/pages/projects.js'), Meteor.subscribe('projects')];
	},
	whileWaiting() {
		this.render('layout', 'loading');
	},
	action() {
		this.render('layout', 'projects');
	},
});

authRoutes.route('/projects', {
	name: 'projects',
	waitOn() {
		return [import('/imports/ui/pages/projects.js'), Meteor.subscribe('projects')];
	},
	whileWaiting() {
		this.render('layout', 'loading');
	},
	action() {
		this.render('layout', 'projects');
	},
});

authRoutes.route('/new', {
	name: 'newproject',
	waitOn() {
		return import('/imports/ui/pages/newproject.js');
	},
	action() {
		this.render('layout', 'newproject');
	},
});

authRoutes.route('/project/:_id', {
	name: 'project',
	waitOn(params) {
		return [import('/imports/ui/pages/project.js'), Meteor.subscribe('projects', params._id)];
	},
	whileWaiting() {
		this.render('layout', 'loading');
	},
	action(params, qs, data) {
		this.render('layout', 'project', data);
	},
	data(params) {
		const proj = Projects.findOne({ _id: params._id });
		return proj;
	},
	onNoData() {
		this.render('layout', 'notfound');
	},
});

authRoutes.route('/project/:_id/stream', {
	name: 'streampage',
	waitOn(params) {
		return [import('/imports/ui/pages/streampage.js'), Meteor.subscribe('projects', params._id)];
	},
	whileWaiting() {
		this.render('layout', 'loading');
	},
	action(params, qs, data) {
		this.render('layout', 'streampage', data);
	},
	data(params) {
		const proj = Projects.findOne({ _id: params._id });
		return proj;
	},
	onNoData() {
		this.render('layout', 'notfound');
	},
});
