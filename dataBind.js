function bindData(obj) {
  for (let key in obj) {
    if (!obj.hasOwnProperty(key)) {
      continue;
    }

    Object.defineProperty(obj, key, {
      configurable: true,
      enumerable: true,
      get() {
        let ele = document.querySelector(`[v-bind="${key}"]`)
        return ele.innerHTML || obj[key]
      },
      set(value) {
        let ele = document.querySelector(`[v-bind="${key}"]`)
        ele.innerHTML = value
      }
    })
  }
}