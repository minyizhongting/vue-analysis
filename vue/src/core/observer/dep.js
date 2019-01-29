/* @flow */

import type Watcher from './watcher'
import { remove } from '../util/index'

let uid = 0

/**
 * A dep is an observable that can have multiple
 * directives subscribing to it.
 */
// Dep是Watcher和数据之间的桥梁
export default class Dep {
  static target: ?Watcher;
  id: number;
  subs: Array<Watcher>;

  constructor () {
    this.id = uid++
    this.subs = []
  }

  addSub (sub: Watcher) {   // 添加一个观察者
    this.subs.push(sub)
  }

  removeSub (sub: Watcher) {    // 移除一个观察者
    remove(this.subs, sub)
  }

  depend () {   // 依赖收集，当存在Dep.target时添加Watcher观察者对象
    if (Dep.target) {   // Dep.target表示全局正在计算的Watcher
      Dep.target.addDep(this)
    }
  }
  // data值变化，会触发setter中的dep.notify，通知绑定在dep对象上的所有watcher对象调用update方法更新视图
  notify () {   // 通知所有观察者
    // stabilize the subscriber list first
    const subs = this.subs.slice()
    for (let i = 0, l = subs.length; i < l; i++) {
      subs[i].update()
    }
  }
}

// the current target watcher being evaluated.
// this is globally unique because there could be only one
// watcher being evaluated at any time.
// 静态属性target，是一个全局唯一的Watcher，同一时间只能有一个全局的Watcher被计算
Dep.target = null   // 收集完依赖后，将Dep.target设置为null，防止继续收集依赖
const targetStack = []

export function pushTarget (_target: ?Watcher) {
  if (Dep.target) targetStack.push(Dep.target)
  Dep.target = _target
}

export function popTarget () {
  Dep.target = targetStack.pop()
}
