/*global Vue, todoStorage */

(function (exports) {

	'use strict';

	var filters = {
		all: function (todos) {
			return todos;
		},
		active: function (todos) {
			return todos.filter(function (todo) {
				return !todo.completed;
			});
		},
		completed: function (todos) {
			return todos.filter(function (todo) {
				return todo.completed;
			});
		}
	};

	// Hackish, but this is a proof of concept
	var watchEnabled = false;
	var firebaseData = {};

	var firebaseStore = new FirebaseStore('vue-todo-firebase');

	exports.app = new Vue({

		// the root element that will be compiled
		el: '.todoapp',

		// app initial state
		data: {
			todos: [],
			newTodo: '',
			editedTodo: null,
			visibility: 'all',
			status: null,
			authenticated: true
		},

		// watch todos change for localStorage persistence
		watch: {
			todos: {
				deep: true,
				handler: function() {
					if (watchEnabled) {
						return firebaseStore.store(firebaseData)
					}
				}
			}
		},

		// computed properties
		// http://vuejs.org/guide/computed.html
		computed: {
			filteredTodos: function () {
				return filters[this.visibility](this.todos);
			},
			remaining: function () {
				return filters.active(this.todos).length;
			},
			allDone: {
				get: function () {
					return this.remaining === 0;
				},
				set: function (value) {
					this.todos.forEach(function (todo) {
						todo.completed = value;
					});
				}
			}
		},

		created: function() {
			var self = this;
			firebaseData.todos = this.todos;

			// Ignore watcher on init
			skipWatch();

			firebaseStore.load().then(updateData);

			firebaseStore.on('dataChange', updateData);

			self.status = firebaseStore.status;
			firebaseStore.on('statusChange', function(status) {
				self.status = status;
			})

			self.authenticated = firebaseStore.authenticated;
			firebaseStore.on('authChange', function(authenticated) {
				self.authenticated = firebaseStore.authenticated;
			})

			function updateData(data) {
				if (!data || !data.todos) {
					return;
				}

				Object.assign(firebaseData, data)
				Object.assign(self, firebaseData)

				skipWatch();
			}

			function skipWatch() {
				watchEnabled = false;
				Vue.nextTick(function() {
					watchEnabled = true;
				});
			}
		},

		// methods that implement data logic.
		// note there's no DOM manipulation here at all.
		methods: {

			pluralize: function (word, count) {
				return word + (count === 1 ? '' : 's');
			},

			addTodo: function () {
				var value = this.newTodo && this.newTodo.trim();
				if (!value) {
					return;
				}
				this.todos.push({ id: this.todos.length + 1, title: value, completed: false });
				this.newTodo = '';
			},

			removeTodo: function (todo) {
				var index = this.todos.indexOf(todo);
				this.todos.splice(index, 1);
			},

			editTodo: function (todo) {
				this.beforeEditCache = todo.title;
				this.editedTodo = todo;
			},

			doneEdit: function (todo) {
				if (!this.editedTodo) {
					return;
				}
				this.editedTodo = null;
				todo.title = todo.title.trim();
				if (!todo.title) {
					this.removeTodo(todo);
				}
			},

			cancelEdit: function (todo) {
				this.editedTodo = null;
				todo.title = this.beforeEditCache;
			},

			removeCompleted: function () {
				this.todos = firebaseData.todos = filters.active(this.todos);
			},

			login: function() {
				return firebaseStore.login()
			},

			logout: function() {
				return firebaseStore.logout()
			}
		},

		// a custom directive to wait for the DOM to be updated
		// before focusing on the input field.
		// http://vuejs.org/guide/custom-directive.html
		directives: {
			'todo-focus': function (el, binding) {
				if (binding.value) {
					el.focus();
				}
			}
		}
	});

})(window);
