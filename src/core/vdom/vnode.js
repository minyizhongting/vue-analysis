/* @flow */

// Virtual DOM其实就是以VNode节点(js对象)作为基础，用对象属性来描述节点，它其实是一层对真实DOM的封装。

// 将原本需要在真实DOM进行的创建节点、删除节点、添加节点等一系列复杂DOM操作放到Virtual DOM中进行，这相对于用innerHTML粗暴地重绘，性能将大大提高。

// 将Virtual DOM修改的地方用diff算法来更新需要修改的地方，能避免很多无谓的DOM修改，从而提高性能。

export default class VNode {
  tag: string | void;         // 节点的标签名
  data: VNodeData | void;     // 当前节点对应的对象
  children: ?Array<VNode>;    // 当前节点的子节点
  text: string | void;        // 当前节点的文本
  elm: Node | void;           // 当前虚拟节点对应的真实DOM节点
  ns: string | void;          // 当前节点的命名空间
  context: Component | void;  // 当前节点的编译作用域
  key: string | number | void;    // key属性，唯一标志
  componentOptions: VNodeComponentOptions | void;     // 组件的option选项
  componentInstance: Component | void;    // 当前节点对应的组件的实例
  parent: VNode | void;     // 当前节点的父节点

  // strictly internal
  raw: boolean;             // 原生HTML或只是普通文本
  isStatic: boolean;        // 是否是静态节点
  isRootInsert: boolean;    // 是否作为根节点插入
  isComment: boolean;       // 是否是注释节点
  isCloned: boolean;        // 是否是克隆节点
  isOnce: boolean;          // 是否有v-once指令
  asyncFactory: Function | void; // async component factory function
  asyncMeta: Object | void;
  isAsyncPlaceholder: boolean;
  ssrContext: Object | void;
  fnContext: Component | void; // real context vm for functional nodes
  fnOptions: ?ComponentOptions; // for SSR caching
  fnScopeId: ?string; // functional scope id support

  constructor (
    tag?: string,
    data?: VNodeData,
    children?: ?Array<VNode>,
    text?: string,
    elm?: Node,
    context?: Component,
    componentOptions?: VNodeComponentOptions,
    asyncFactory?: Function
  ) {
    this.tag = tag
    this.data = data
    this.children = children
    this.text = text
    this.elm = elm
    this.ns = undefined
    this.context = context
    this.fnContext = undefined
    this.fnOptions = undefined
    this.fnScopeId = undefined
    this.key = data && data.key
    this.componentOptions = componentOptions
    this.componentInstance = undefined
    this.parent = undefined
    this.raw = false
    this.isStatic = false
    this.isRootInsert = true
    this.isComment = false
    this.isCloned = false
    this.isOnce = false
    this.asyncFactory = asyncFactory
    this.asyncMeta = undefined
    this.isAsyncPlaceholder = false
  }

  // DEPRECATED: alias for componentInstance for backwards compat.
  /* istanbul ignore next */
  get child (): Component | void {
    return this.componentInstance
  }
}

// 创建一个空的VNode节点
export const createEmptyVNode = (text: string = '') => {
  const node = new VNode()
  node.text = text
  node.isComment = true
  return node
}

// 创建一个文本节点
export function createTextVNode (val: string | number) {
  return new VNode(undefined, undefined, undefined, String(val))
}

// optimized shallow clone
// used for static nodes and slot nodes because they may be reused across
// multiple renders, cloning them avoids errors when DOM manipulations rely
// on their elm reference.

// 克隆一个VNode节点
export function cloneVNode (vnode: VNode): VNode {
  const cloned = new VNode(
    vnode.tag,
    vnode.data,
    vnode.children,
    vnode.text,
    vnode.elm,
    vnode.context,
    vnode.componentOptions,
    vnode.asyncFactory
  )
  cloned.ns = vnode.ns
  cloned.isStatic = vnode.isStatic
  cloned.key = vnode.key
  cloned.isComment = vnode.isComment
  cloned.fnContext = vnode.fnContext
  cloned.fnOptions = vnode.fnOptions
  cloned.fnScopeId = vnode.fnScopeId
  cloned.isCloned = true
  return cloned
}
