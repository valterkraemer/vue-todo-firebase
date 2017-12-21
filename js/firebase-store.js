;(function() {
	let EventEmitter = function() {
		this.events = {}
		this.onceEvents = {}
	}

	EventEmitter.prototype.on = function(event, listener) {
		if (this.onceEvents[event]) {
			while (this.onceEvents[event].length) {
				this.onceEvents[event].shift()()
			}
		}

		this.events[event] = this.events[event] || []
		this.events[event].push(listener)
	}

	EventEmitter.prototype.onceOn = function(event, listener) {
		this.onceEvents[event] = this.onceEvents[event] || []
		this.onceEvents[event].push(listener)
	}

	EventEmitter.prototype.emit = function(event, data) {
		if (!this.events[event]) {
			return
		}

		for (let i = 0; i < this.events[event].length; i++) {
			this.events[event][i](data)
		}
	}

	window.MyEventEmitter = EventEmitter
})()

;(function(exports) {
	'use strict';

	const id = 'vue-todo-firebase'

	let ObjectStorage = {
		get: key => {
			try {
				return JSON.parse(window.localStorage[`mavo-offline-${id}-${key}`])
			} catch (err) {}
		},
		set: (key, value) => {
			try {
				window.localStorage[`mavo-offline-${id}-${key}`] = JSON.stringify(value)
			} catch (err) {}
		}
	}

	let store = new MyEventEmitter()

	const config = {
		apiKey: "AIzaSyBLT3WLjFbEtHIQ5aAuk7E1_8l5l9Tc87M",
		authDomain: "test-projects-13910.firebaseapp.com",
		databaseURL: "https://test-projects-13910.firebaseio.com",
		projectId: "test-projects-13910",
		storageBucket: "",
		messagingSenderId: "20697715442"
	}

	let app = firebase.initializeApp(config)
	let db = app.database().ref(id)

	let rev

	let online = false
	let loading = false
	let storing = false
	updateStatus()

	let saveData
	let promise = Promise.resolve()

	app.database().ref('.info/connected').on('value', snapshot => {
		online = snapshot.val()
		updateStatus()
	})

	db.on('value', snapshot => {
		let data = snapshot.val()

		if (isNewData(data)) {
			return updateData(data)
		}
	})

	function load() {
		promise = promise.then(fetch)

		let storageData = ObjectStorage.get('data')

		if (storageData) {
			rev = storageData._rev

			promise.then(data => {
				if (isNewData(data)) {
					return updateData(data)
				}

				if (ObjectStorage.get('modified')) {
					return save(ObjectStorage.get('data'))
				}
			})

			return Promise.resolve(storageData)
		}

		return promise.then(data => {
			rev = Number.isInteger(data._rev) ? data._rev : 1
			ObjectStorage.set('data', data)
			ObjectStorage.set('modified', false)
			return data
		})
	}

	function fetch() {
		loading = true
		updateStatus()

		return helper().then(snapshot => {
			let data = snapshot.val() || {}

			loading = false
			updateStatus()

			return data
		})

		function helper() {
			return db.once('value').catch(err => {
				if (err.status === 0) {
					return delay(5000).then(helper)
				}
				return Promise.reject(err)
			})
		}
	}

	function save(data) {
		console.log('save')
		ObjectStorage.set('data', data)
		ObjectStorage.set('modified', true)

		saveData = data

		if (storing) {
			return Promise.resolve()
		}

		storing = true
		updateStatus()

		promise = promise.then(helper)

		function helper() {
			return db.transaction(currentData => {
				rev = (currentData && Number.isInteger(currentData._rev)) ? currentData._rev + 1 : 1

				let transactionData = Object.assign({}, saveData, {
					_rev: rev
				})

				saveData = undefined

				return transactionData
			}).then(response => {
				if (saveData) {
					return helper()
				}

				ObjectStorage.set('data', response.snapshot.val())
				ObjectStorage.set('modified', false)
				
				storing = false
				updateStatus()

			}).catch(err => {
				switch (err.status) {
					case 0:
					return delay(5000).then(helper)
					case 409:
					// TODO: resolve conflict
				}

				return Promise.reject(err)
			})
		}
	}

	function updateStatus() {
		// 0: Offline
		// 1: Up to date
		// 2: Loading
		// 3: Storing

		let status = 0

		if (online) {
			status = 1

			if (storing) {
				status = 3
			}

			if (loading) {
				status = 2
			}
		}

		if (store.status === status) {
			return
		}

		store.status = status
		store.emit('statusChange', status)
	}

	function isNewData(data) {
		return data && Number.isInteger(data._rev) && (!Number.isInteger(rev) || data._rev > rev)
	}

	function updateData(data) {
		rev = Number.isInteger(data._rev) ? data._rev : 1
		ObjectStorage.set('data', data)
		ObjectStorage.set('modified', false)

		store.emit('dataChange', data)
	}

	function delay (ms) {
		return new Promise(resolve => {
			setTimeout(resolve, ms)
		})
	}

	store.load = load
	store.store = save

	exports.firebaseStore = store

})(window)
