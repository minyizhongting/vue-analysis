/* @flow */

import { toArray } from '../util/index'

// 通过Vue.use(plugin)，就是在执行install方法

// vue-router的install方法会给每个组件注入beforeCreate和destroyed钩子函数，在beforeCreate做一些私有属性定义和路由初始化工作

export function initUse (Vue: GlobalAPI) {
  Vue.use = function (plugin: Function | Object) {
    // this._installedPlugins，它存储所有注册过的plugin
    const installedPlugins = (this._installedPlugins || (this._installedPlugins = []))
    if (installedPlugins.indexOf(plugin) > -1) {
      return this
    }

    // additional parameters
    const args = toArray(arguments, 1)
    args.unshift(this)
    // 判断plugin有没有定义install方法，若有则调用该方法，执行的第一个参数是Vue
    if (typeof plugin.install === 'function') {
      plugin.install.apply(plugin, args)
    } else if (typeof plugin === 'function') {
      plugin.apply(null, args)
    }
    // 把plugin存储到installedPlugins中
    installedPlugins.push(plugin)
    return this
  }
}
