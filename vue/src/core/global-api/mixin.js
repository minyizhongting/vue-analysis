/* @flow */

import { mergeOptions } from '../util/index'

export function initMixin (Vue: GlobalAPI) {
	// 把要混入的对象通过mergeOptions合并到Vue的options中
	// 每个组件的构造函数都会在extend阶段合并vue.options到自身的options中，也就相当于每个组件都定义了mixin定义的选项
  Vue.mixin = function (mixin: Object) {
    this.options = mergeOptions(this.options, mixin)
    return this
  }
}
