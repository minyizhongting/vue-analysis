/* @flow */

import { parse } from './parser/index'
import { optimize } from './optimizer'
import { generate } from './codegen/index'
import { createCompilerCreator } from './create-compiler'

// `createCompilerCreator` allows creating compilers that use alternative
// parser/optimizer/codegen, e.g the SSR optimizing compiler.
// Here we just export a default compiler using the default parts.
export const createCompiler = createCompilerCreator(function baseCompile (
  template: string,
  options: CompilerOptions
): CompiledResult {
  // 解析模板字符串生成AST
  // parse会用正则等方式解析template模板中的指令、class、style等数据，形成AST树
  const ast = parse(template.trim(), options)
  if (options.optimize !== false) {
    // 优化AST语法树
    // Vue是数据驱动，是响应式的，template模板中并不是所有数据都是响应式的，有许多数据初始化后不会有变化
    // update更新界面时，会有patch的过程，diff算法会直接跳过静态节点，从而减少比较的过程，优化patch的性能
    optimize(ast, options)
  }
  // 将优化后的AST树转换成可执行的代码
  const code = generate(ast, options)
  // template模板经历过parse->optimize->codegen三个过程后，就可以得到render function函数了
  return {
    ast,
    render: code.render,
    staticRenderFns: code.staticRenderFns
  }
})
