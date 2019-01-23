/* @flow */

import {
  warn,
  remove,
  isObject,
  parsePath,
  _Set as Set,
  handleError
} from '../util/index'

import { traverse } from './traverse'
import { queueWatcher } from './scheduler'
import Dep, { pushTarget, popTarget } from './dep'

import type { SimpleSet } from '../util/index'

let uid = 0

// user-watcher
// 在watch中定义的，只要监听的属性变了，都会触发定义好的回调函数
// computed-watcher
// 每个computed属性，最后都会生成一个对应的watcher对象
// render-watcher
// function() { vm._update(vm._render(), hydrating);} 当data/computed中的属性改变时，会调用该render-watcher来更新组件视图

// 三个watcher的执行顺序：computed-watcher -> user-watcher -> render-watcher
// 尽可能的保证，在更新组件视图时，computed属性已经是最新值了
// 如果render-watcher排在computed-watcher前面，会导致页面更新时computed值是旧数据

/**
 * A watcher parses an expression, collects dependencies,
 * and fires callback when the expression value changes.
 * This is used for both the $watch() api and directives.
 */
// Watcher是一个观察者对象，依赖收集后，Watcher对象会被保存在Deps中，数据变动时，会有Deps通知Watcher实例
export default class Watcher {
  vm: Component;
  expression: string;
  cb: Function;
  id: number;
  deep: boolean;
  user: boolean;
  lazy: boolean;
  sync: boolean;
  dirty: boolean;
  active: boolean;
  deps: Array<Dep>;
  newDeps: Array<Dep>;
  depIds: SimpleSet;
  newDepIds: SimpleSet;
  getter: Function;
  value: any;

  constructor (
    vm: Component,
    expOrFn: string | Function,   // 更新函数
    cb: Function,
    options?: ?Object,        
    isRenderWatcher?: boolean
  ) {
    this.vm = vm
    if (isRenderWatcher) {
      vm._watcher = this
    }
    vm._watchers.push(this)
    // options
    // 当走到initData方法时，options不存在
    // 当走到initComputed方法时，computedWatcherOptions = {lazy: true}
    if (options) {    // initComputed中，实例化computed watcher
      this.deep = !!options.deep
      this.user = !!options.user
      this.lazy = !!options.lazy
      this.sync = !!options.sync
    } else {
      this.deep = this.user = this.lazy = this.sync = false
    }
    this.cb = cb
    this.id = ++uid // uid for batching
    this.active = true
    this.dirty = this.lazy // for lazy watchers     // 延迟计算 所以数据是脏的
    this.deps = []
    this.newDeps = []
    this.depIds = new Set()
    this.newDepIds = new Set()
    this.expression = process.env.NODE_ENV !== 'production'
      ? expOrFn.toString()
      : ''
    // parse expression for getter
    if (typeof expOrFn === 'function') {
      this.getter = expOrFn     // 把传入的函数赋值给this.getter
    } else {
      this.getter = parsePath(expOrFn)
      if (!this.getter) {
        this.getter = function () {}
        process.env.NODE_ENV !== 'production' && warn(
          `Failed watching path: "${expOrFn}" ` +
          'Watcher only accepts simple dot-delimited paths. ' +
          'For full control, use a function instead.',
          vm
        )
      }
    }
    this.value = this.lazy      
      ? undefined
      : this.get()    // 执行this.get()方法
  }

  /**
   * Evaluate the getter, and re-collect dependencies.
   */
  get () {
    pushTarget(this)    // 缓存到Dep.target中
    let value
    const vm = this.vm
    try {
      value = this.getter.call(vm, vm)    // 最核心的，执行updateComponent方法，通知vue vdom的diff算法更新视图
    } catch (e) {
      if (this.user) {
        handleError(e, vm, `getter for watcher "${this.expression}"`)
      } else {
        throw e
      }
    } finally {
      // "touch" every property so they are all tracked as
      // dependencies for deep watching
      if (this.deep) {
        traverse(value)
      }
      popTarget()
      this.cleanupDeps()
    }
    return value
  }

  /**
   * Add a dependency to this directive.
   */
  addDep (dep: Dep) {
    const id = dep.id
    if (!this.newDepIds.has(id)) {
      this.newDepIds.add(id)        
      this.newDeps.push(dep)        // 将dep对象加入到watcher对象的newDeps队列中
      if (!this.depIds.has(id)) {
        dep.addSub(this)    // 同时将watcher对象也加入到dep对象的subs队列中
      }
    }
  }

  /**
   * Clean up for dependency collection.
   */
  cleanupDeps () {
    let i = this.deps.length
    while (i--) {
      const dep = this.deps[i]
      if (!this.newDepIds.has(dep.id)) {
        dep.removeSub(this)
      }
    }
    let tmp = this.depIds
    this.depIds = this.newDepIds
    this.newDepIds = tmp
    this.newDepIds.clear()
    tmp = this.deps
    this.deps = this.newDeps
    this.newDeps = tmp
    this.newDeps.length = 0
  }

  /**
   * Subscriber interface.
   * Will be called when a dependency changes.
   */
  // 每次数据变更，都会调用watcher的update方法去更新
  update () {
    /* istanbul ignore else */
    if (this.lazy) {    // 把this.dirty设为true，继而调用watcher.evaluate()，去更新
      this.dirty = true
    } else if (this.sync) {
      this.run()
    } else {
      // 一般情况下，没有其他配置会进入这里，将watcher推入队列
      // 等主任务执行完后，开始执行microTask，进入flushSchedulerQueue方法
      queueWatcher(this)    // Vue的异步队列更新
    }
  }

  /**
   * Scheduler job interface.
   * Will be called by the scheduler.
   */
  // 实际就是执行了get()方法，从而触发this.getter方法的执行，渲染页面
  run () {
    if (this.active) {
      const value = this.get()    // 此处会调用watcher.get()方法，也是数据驱动视图更新的核心方法
      if (
        value !== this.value ||
        // Deep watchers and watchers on Object/Arrays should fire even
        // when the value is the same, because the value may
        // have mutated.
        isObject(value) ||
        this.deep
      ) {
        // set new value
        const oldValue = this.value
        this.value = value
        if (this.user) {    // user watcher
          try {
            this.cb.call(this.vm, value, oldValue) 
          } catch (e) {
            handleError(e, this.vm, `callback for watcher "${this.expression}"`)
          }
        } else {
          this.cb.call(this.vm, value, oldValue)
        }
      }
    }
  }

  /**
   * Evaluate the value of the watcher.
   * This only gets called for lazy watchers.
   */
  // state.js中，initComputed方法，初始化computed watcher，lazy设置为true，dirty等于lazy也为true
  // 只有dirty为true时，才会执行watcher.evaluate()
  // 因此只要不更新计算属性中的data属性的值，在第一次获取值后，watcher.lazy始终未false，也就永远不会执行watcher.evaluate()
  // 所以这个计算属性永远不会重新求值，一直使用上一次获得(所谓的缓存)的值
  // 一旦data属性的值发生变化，会触发update()导致页面重新渲染，重新initComputed，那么this.dirty = this.lazy = true，计算属性就会重新取值

  // 只有lazy watcher才执行this.get()
  // 求值过程中，会执行value=this.getter.call(vm,vm)，实际就是执行了计算属性定义的getter函数，否则直接返回value
  evaluate () {
    this.value = this.get()   // 重新求值
    this.dirty = false
  }

  /**
   * Depend on all deps collected by this watcher.
   */
  depend () {
    let i = this.deps.length
    while (i--) {
      this.deps[i].depend()
    }
  }

  /**
   * Remove self from all dependencies' subscriber list.
   */
  teardown () {
    if (this.active) {
      // remove self from vm's watcher list
      // this is a somewhat expensive operation so we skip it
      // if the vm is being destroyed.
      if (!this.vm._isBeingDestroyed) {
        remove(this.vm._watchers, this)
      }
      let i = this.deps.length
      while (i--) {
        this.deps[i].removeSub(this)
      }
      this.active = false
    }
  }
}
