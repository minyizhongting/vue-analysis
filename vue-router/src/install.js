import View from './components/view'
import Link from './components/link'

export let _Vue

// 当用户执行Vue.use(VueRouter)时，实际上就是在执行install函数
// vue-router的install方法会给每个组件注入beforeCreate和destroyed钩子函数，在beforeCreate做一些私有属性定义和路由初始化工作
export function install (Vue) {
  // 确保install逻辑只执行一次，用了install.installed变量做已安装的标志位
  if (install.installed && _Vue === Vue) return
  install.installed = true

  // 作为Vue插件，对Vue对象是有依赖的，若单独去import会增加包体积，因此通过这种方式拿到Vue对象
  _Vue = Vue

  const isDef = v => v !== undefined

  const registerInstance = (vm, callVal) => {
    let i = vm.$options._parentVnode
    if (isDef(i) && isDef(i = i.data) && isDef(i = i.registerRouteInstance)) {
      i(vm, callVal)
    }
  }

  // vue-router最重要的一步，就是利用Vue.mixin把beforeCreate和destroyed钩子函数注入到每一个组件中
  Vue.mixin({
    beforeCreate () {
      if (isDef(this.$options.router)) {
        this._routerRoot = this
        this._router = this.$options.router
        this._router.init(this)
        Vue.util.defineReactive(this, '_route', this._router.history.current)
      } else {
        this._routerRoot = (this.$parent && this.$parent._routerRoot) || this
      }
      registerInstance(this, this)
    },
    destroyed () {
      registerInstance(this)
    }
  })

  // 在原型上定义$router和$route两个属性的get方法
  // 因此可以在组件实例上访问this.$router以及this.$route
  Object.defineProperty(Vue.prototype, '$router', {
    get () { return this._routerRoot._router }
  })

  Object.defineProperty(Vue.prototype, '$route', {
    get () { return this._routerRoot._route }
  })

  // 未定义有全局的<router-link>和<router-view>2个组件
  Vue.component('RouterView', View)
  Vue.component('RouterLink', Link)

  const strats = Vue.config.optionMergeStrategies
  // use the same hook merging strategy for route hooks
  strats.beforeRouteEnter = strats.beforeRouteLeave = strats.beforeRouteUpdate = strats.created
}
