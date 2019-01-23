import { initMixin } from './init'
import { stateMixin } from './state'
import { renderMixin } from './render'
import { eventsMixin } from './events'
import { lifecycleMixin } from './lifecycle'
import { warn } from '../util/index'

// Vue实际上是一个构造函数，当用new来实例化Vue时，会执行_init方法
function Vue (options) {
  if (process.env.NODE_ENV !== 'production' &&
    !(this instanceof Vue)
  ) {
    warn('Vue is a constructor and should be called with the `new` keyword')
  }
  this._init(options)
}

initMixin(Vue)
stateMixin(Vue)
eventsMixin(Vue)
lifecycleMixin(Vue)
renderMixin(Vue)

export default Vue

// new Vue时，会将template字符串转换成render函数
// render函数执行后得到vnode对象(虚拟dom)
// 再调用_update方法将虚拟dom更新为真实dom


// template中引用了{{message}}之类的属性，因此render函数里会调用到vm.message，会触发defineReactive中的get方法
// get方法里面就会进行(该属性)依赖的收集

// dom初次渲染是通过(监听整个模板的)watcher对象初始化时调用watcher.get方法实现的
// watcher.get方法主要是计算getter函数的值和计算依赖，Dep.target就是当前依赖的全局的watcher对象
// 具体方法如下：
// 1. pushTarget(this)，将this(当前watcher对象)赋值给Dep.target
// 2. 调用this.getter，this.getter会访问所有依赖的属性，同事触发属性的getter方法
// 3. 调用属性getter方法中的dep.depend()，完成dep和watcher的绑定
// 4. porTarget()将Dep.target值设为targetStack栈中的上一个(没有则为空)


