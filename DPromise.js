const PENDING = 0
const FULLFILLED = 1
const REJECTED = 2
class DPromise {
  constructor(handler) {
    this.status = PENDING
    this.successQueue = []
    this.failedQueue = []
    this.value = undefined
    try {
      handler.call(null, this._resolve.bind(this), this._reject.bind(this))
    } catch (error) {
      this._reject(error)
    }
  }

  _resolve(val) {
    let run = () => {
      if (this.status !== PENDING)
        return
      let runSuccessCb = (value) => {
        let cb
        while (cb = this.successQueue.shift()) {
          cb.call(null, value)
        }
      }

      let runFailedCb = (error) => {
        let cb
        while (cb = this.failedQueue.shift()) {
          cb.call(null, errlr)
        }
      }

      if (val instanceof DPromise) {
        val.then(data => {
          this.status = FULLFILLED
          this.value = data
          runSuccessCb(data)
        }, error => {
          this.status = REJECTED
          this.value = error
          runFailedCb(error)
        })
      } else {
        this.status = FULLFILLED
        this.value = val
        runSuccessCb(val)
      }
    }

    setTimeout(run, 0)
  }

  _reject(error) {
    let run = () => {
      if (this.status !== PENDING)
        return
      this.status = REJECTED
      this.value = error
      let cb
      while (cb = this.failedQueue.shift()) {
        cb(error)
      }
    }

    setTimeout(run, 0)
  }

  then(successCb, failedCb) {
    const { status, value } = this
    return new DPromise((resolveNext, rejectNext) => {
      let fullfilled = (data) => {
        try {
          if (typeof successCb === 'function') {
            let res = successCb(data)
            if (res instanceof DPromise) {
              res.then(resolveNext, rejectNext)
            } else {
              resolveNext(res)
            }
          } else {
            resolveNext(data)
          }
        } catch (error) {
          rejectNext(error)
        }
      }

      let rejected = (error) => {
        try {
          if (typeof failedCb === 'function') {
            let res = failedCb(error)
            if (res instanceof DPromise) {
              res.then(rejectNext, rejectNext)
            } else {
              rejectNext(error)
            }
          } else {
            rejectNext(error)
          } 
        } catch (err) {
          rejectNext(err)
        }
      }

      switch (status) {
        case PENDING:
          this.successQueue.push(fullfilled)
          this.failedQueue.push(rejected)
          break
        case FULLFILLED:
          fullfilled(value)
          break
        case REJECTED:
          rejected(value)
          break
      }
    })
  }
}