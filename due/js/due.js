var parsePath = function (expOrFn) {
  let list = expOrFn.split('.')
  return function (obj) {
    let i = list.length
    while (i--) {
      obj = obj[list[i]]
    }

    return obj
  }
}
var noop = () => { }

var sharePropertyDescriptor = {
  enumerable: true,
  configurable: true,
  get: noop,
  set: noop
}
function proxy(target, shareKey, key) {
  sharePropertyDescriptor.get = function () {
    return this[shareKey][key]
  }

  sharePropertyDescriptor.set = function (val) {
    this[shareKey][key] = val
  }

  Object.defineProperty(target, key, sharePropertyDescriptor)
}

function Due(options) {
  this.init(options)
}

Due.prototype.init = function (options) {
  this.$options = options
  this._events = Object.create(null)
  this.initData()
  this.initComputed()
  this.initMethod()
  this.mount()
}

Due.prototype.mount = function () {
  let self = this
  this.$template = document.querySelector(self.$options.el).outerHTML
  new Watcher(this, function () {
    let template = this.$template
    let parseRe = /{{\s*([^\s{}]+)\s*}}/g
    let match
    while (match = parseRe.exec(template)) {
      let attrName = match[1]
      let attrVal = parsePath(attrName)(self)
      template = template.replace(match[0], attrVal)
    }
    let bindRe = /\s+:([^:"'\s]+)\s*=\s*(?:"|')?([^:"'\s]+)(?:"|')?\s*/g
    while (match = bindRe.exec(template)) {
      let attrName = match[2]
      let attrVal = parsePath(attrName)(self)
      template = template.replace(match[0], ` ${match[1]}="${attrVal}" `)
    }
    document.querySelector(self.$options.el).outerHTML = template
    let eventDomRe = /id=(?:"|')?(\w+)(?:"|')?[^<>@]+(@(\w+)\s*=\s*(?:"|')?(\w+)(?:"|')?)/g
    while (match = eventDomRe.exec(template)) {
      let id = match[1]
      let eventName = match[3]
      let eventMethod = match[4]
      let method = parsePath(eventMethod)(self).bind(self)
      document.querySelector(`#${id}`).addEventListener(eventName, method, false)
    }
  }, noop, {}, true)
}

Due.prototype.initData = function () {
  let dataExp = this.$options.data
  if (typeof dataExp !== 'object' && typeof dataExp !== 'function') {
    return
  }
  let data = typeof dataExp === 'object' ? dataExp : dataExp.call(this)
  this.$data = data
  observe(data)
  let keys = Object.keys(data)
  var i = keys.length
  while (i--) {
    if (!(keys[i] in this)) {
      proxy(this, '$data', keys[i])
    }
  }
}

Due.prototype.initComputed = function () {
  this._computedwatchers = Object.create(null)
  let computed = this.$options.computed
  let keys = Object.keys(computed)
  let i = keys.length
  while (i--) {
    let key = keys[i]
    let userDef = computed[key]
    let getter = typeof userDef === 'function' ? userDef : userDef.get
    this._computedwatchers[key] = new Watcher(this, getter || noop, noop, { lazy: true })
    if (!(key in this)) {
      defineComputed(this, key, userDef)
    }
  }
}

Due.prototype.initMethod = function () {
  let methods = this.$options.methods
  let keys = Object.keys(methods)
  let i = keys.length
  while (i--) {
    let key = keys[i]
    if (!(key in this)) {
      Object.defineProperty(this, key, {
        configurable: true,
        enumerable: true,
        get: () => {
          return methods[key]
        },
        set: noop
      })
    }
  }
}

function defineComputed(vm, key, userDef) {
  sharePropertyDescriptor.get = function () {
    let watcher = vm._computedwatchers[key]
    if (watcher) {
      if (watcher.dirty) {
        watcher.evaluate()
      }
      if (Dep.target) {
        watcher.depend()
      }
      return watcher.value
    }
  }
  sharePropertyDescriptor.set = (typeof userDef === 'function' ? noop : (userDef.set || noop))
  Object.defineProperty(vm, key, sharePropertyDescriptor)
}

function Observer(value) {
  this.value = value
  Object.defineProperty(value, '__ob__', this)
  var keys = Object.keys(value)
  var i = keys.length
  while (i--) {
    defineReactive(value, keys[i], value[keys[i]])
  }
}

function observe(data) {
  if (typeof data !== 'object') {
    return
  }

  if (Object.hasOwnProperty('__ob__') && data.__ob__ instanceof Observer) {
    return data.__ob__
  }

  return new Observer(data)
}

function defineReactive(obj, key, val) {
  var dep = new Dep()
  Object.defineProperty(obj, key, {
    configurable: true,
    enumerable: true,
    get: function getter() {
      if (Dep.target) {
        dep.depend()
      }
      return val
    },
    set: function setter(newVal) {
      if (newVal === val) {
        return
      }
      val = newVal
      dep.notify()
    }
  })
}

var uid = 0
function Dep() {
  this.subs = []
  this.id = uid++
}

Dep.prototype.addSub = function (sub) {
  this.subs.push(sub)
}

Dep.prototype.removeSub = function (sub) {
  this.subs.splice(this.subs.indexOf(sub), 1)
}

Dep.prototype.depend = function () {
  if (Dep.target) {
    Dep.target.addDep(this)
  }
}

Dep.prototype.notify = function () {
  let subs = this.subs.slice()
  subs.sort((a, b) => a.id - b.id)
  for (let i = 0; i < subs.length; i++) {
    subs[i].update()
  }
}

Dep.target = null
var targetStack = []
function pushTarget(target) {
  targetStack.push(target)
  Dep.target = target
}

function popTarget() {
  targetStack.pop()
  Dep.target = targetStack[targetStack.length - 1]
}

var wid = 0
function Watcher(vm, expOrFn, cb, options, isRenderWatcher) {
  this.id = wid++
  this.cb = cb
  this.vm = vm
  if (isRenderWatcher) {
    vm._watcher = this
  }
  (vm._watchers || (vm._watchers = [])).push(this)
  if (options) {
    this.lazy = options.lazy
    this.dirty = options.lazy
  } else {
    this.lazy = this.dirty = false
  }
  this.deps = []
  this.newDeps = []
  this.depIds = new Set()
  this.newDepIds = new Set()
  if (typeof expOrFn === 'function') {
    this.getter = expOrFn
  } else {
    this.getter = parsePath(expOrFn)
  }

  this.value = this.lazy ? undefined : this.get()
}

Watcher.prototype.get = function () {
  pushTarget(this)
  let value
  try {
    value = this.getter.call(this.vm, this.vm)
  } catch (error) {
  } finally {
    this.cleanupDeps()
    popTarget()
  }
  return value
}

Watcher.prototype.addDep = function addDep(dep) {
  var id = dep.id;
  if (!this.newDepIds.has(id)) {
    this.newDepIds.add(id);
    this.newDeps.push(dep);
    if (!this.depIds.has(id)) {
      dep.addSub(this);
    }
  }
}
Watcher.prototype.cleanupDeps = function cleanupDeps() {
  var i = this.deps.length;
  while (i--) {
    var dep = this.deps[i];
    if (!this.newDepIds.has(dep.id)) {
      dep.removeSub(this);
    }
  }
  var tmp = this.depIds;
  this.depIds = this.newDepIds;
  this.newDepIds = tmp;
  this.newDepIds.clear();
  tmp = this.deps;
  this.deps = this.newDeps;
  this.newDeps = tmp;
  this.newDeps.length = 0;
}
Watcher.prototype.update = function update() {
  if (this.lazy) {
    this.dirty = true
  } else {
    this.run()
  }
}
Watcher.prototype.run = function run() {
  try {
    var oldValue = this.value
    var value = this.get()
    this.value = value
    this.cb.call(this.vm, value, oldValue)
  } catch (error) {
  }
}

Watcher.prototype.depend = function depend() {
  var i = this.deps.length;
  while (i--) {
    this.deps[i].depend();
  }
};

Watcher.prototype.teardown = function teardown() {
  this.vm._watchers.splice(this.vm._watchers.indexOf(this), 1)
  var i = this.deps.length;
  while (i--) {
    this.deps[i].removeSub(this);
  }
}

Watcher.prototype.evaluate = function evaluate() {
  this.value = this.get()
  this.dirty = false
}