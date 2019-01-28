/* @flow */

import type Watcher from './watcher'
import config from '../config'
import { callHook, activateChildComponent } from '../instance/lifecycle'

import {
  warn,
  nextTick,
  devtools
} from '../util/index'

export const MAX_UPDATE_COUNT = 100

const queue: Array<Watcher> = []
const activatedChildren: Array<Component> = []
let has: { [key: number]: ?true } = {}
let circular: { [key: number]: number } = {}
let waiting = false
let flushing = false
let index = 0

/**
 * Reset the scheduler's state.
 */
// 状态恢复，把流程控制状态的一些变量恢复到初始值，把watcher队列清空
function resetSchedulerState () {
  index = queue.length = activatedChildren.length = 0
  has = {}
  if (process.env.NODE_ENV !== 'production') {
    circular = {}
  }
  waiting = flushing = false
}

/**
 * Flush both queues and run the watchers.
 */
// 函数目的是调用queue中所有watcher的watcher.run方法
// 被调用后，通过新的虚拟dom与旧的虚拟dom做diff算法后生成新的真实dom
function flushSchedulerQueue () {
  flushing = true
  let watcher, id

  // Sort queue before flush.
  // This ensures that:
  // 1. Components are updated from parent to child. (because parent is always
  //    created before the child)
  // 2. A component's user watchers are run before its render watcher (because
  //    user watchers are created before the render watcher)
  // 3. If a component is destroyed during a parent component's watcher run,
  //    its watchers can be skipped.

  // flush队列前先排序
  // 目的是
  // 1.Vue中的组件的创建与更新有点类似于事件捕获，都是从最外层向内层延伸，所以要先
  // 调用父组件的创建与更新
  // 2. userWatcher比renderWatcher创建要早
  // 3. 如果父组件的watcher调用run时将父组件干掉了，那其子组件的watcher也就没必要调用了



  // 对队列做了从小到大的排序
  // 1. 组件的更新由父到子，因为父组件的创建过程是先于子的，所以watcher的创建也是先父后子，执行属性也是先父后子
  // 2. 用户的自定义watcher要优先于渲染watcher执行，因为user watcher是在render watcher之前创建的
  // 3. 若组件在父组件的watcher执行期间被销毁，name它对应的watcher执行都可以被跳过，所以父组件的watcher应该先执行
  queue.sort((a, b) => a.id - b.id)

  // do not cache length because more watchers might be pushed
  // as we run existing watchers
  // 此处不缓存queue的length，因为在循环过程中queue依然可能被添加watcher导致length长度的改变
  for (index = 0; index < queue.length; index++) {
    // 取出每个watcher
    watcher = queue[index]
    id = watcher.id
    // 清掉标记
    has[id] = null
    // 更新dom
    watcher.run()   // 遍历后，拿到对应的watcher，执行watcher.run()
    // in dev build, check and stop circular updates.
    // dev环境下，监测是否为死循环
    if (process.env.NODE_ENV !== 'production' && has[id] != null) {
      circular[id] = (circular[id] || 0) + 1
      if (circular[id] > MAX_UPDATE_COUNT) {
        warn(
          'You may have an infinite update loop ' + (
            watcher.user
              ? `in watcher with expression "${watcher.expression}"`
              : `in a component render function.`
          ),
          watcher.vm
        )
        break
      }
    }
  }

  // keep copies of post queues before resetting state
  const activatedQueue = activatedChildren.slice()
  const updatedQueue = queue.slice()    // 是更新了的watcher数组

  resetSchedulerState()

  // call component updated and activated hooks
  callActivatedHooks(activatedQueue)
  callUpdatedHooks(updatedQueue)    // 对数组进行遍历，只有满足当前watcher为vm._watcher以及组件已经mounted这两个条件，才会执行update钩子函数

  // devtool hook
  /* istanbul ignore if */
  if (devtools && config.devtools) {
    devtools.emit('flush')
  }
}

function callUpdatedHooks (queue) {
  let i = queue.length
  while (i--) {
    const watcher = queue[i]
    const vm = watcher.vm
    if (vm._watcher === watcher && vm._isMounted) {
      callHook(vm, 'updated')     // update的执行时机是在FlushSchedulerQueue函数调用的时候
    }
  }
}

/**
 * Queue a kept-alive component that was activated during patch.
 * The queue will be processed after the entire tree has been patched.
 */
export function queueActivatedComponent (vm: Component) {
  // setting _inactive to false here so that a render function can
  // rely on checking whether it's in an inactive tree (e.g. router-view)
  vm._inactive = false
  activatedChildren.push(vm)
}

function callActivatedHooks (queue) {
  for (let i = 0; i < queue.length; i++) {
    queue[i]._inactive = true
    activateChildComponent(queue[i], true /* true */)
  }
}

/**
 * Push a watcher into the watcher queue.
 * Jobs with duplicate IDs will be skipped unless it's
 * pushed when the queue is being flushed.
 */
 // 引入队列的概念，派发更新时，不会每次数据改变都触发watcher的回调
 // 而是把watcher先添加到一个队列里，然后在nextTick后执行flushSchedulerQueue
// 数据发生变化，watcher更新视图 异步更新 
// Vue异步执行DOM更新，只要观察到数据变化，vue将开启一个队列，并缓冲在同一事件循环中发生的所有数据改变
export function queueWatcher (watcher: Watcher) {
  const id = watcher.id
  // 判断这个watcher是否已经放入过队列
  if (has[id] == null) {    // has对象保证同一个Watcher值添加一次
    has[id] = true
    if (!flushing) {
      queue.push(watcher)     // 将当前watcher放入队列
    } else {
      // if already flushing, splice the watcher based on its id
      // if already past its id, it will be run next immediately.
      let i = queue.length - 1
      while (i > index && queue[i].id > watcher.id) {
        i--
      }
      queue.splice(i + 1, 0, watcher)
    }
    // queue the flush
    if (!waiting) {   // waiting保证对nextTick(flushSchedulerQueue)只调用一次
      waiting = true
      nextTick(flushSchedulerQueue)   // 将flushSchedulerQueue(冲洗队列)放入nextTick
    }
  }
}
