/**
 * Not type-checking this file because it's mostly vendor code.
 */

/*!
 * HTML Parser By John Resig (ejohn.org)
 * Modified by Juriy "kangax" Zaytsev
 * Original code by Erik Arvidsson, Mozilla Public License
 * http://erik.eae.net/simplehtmlparser/simplehtmlparser.js
 */

import { makeMap, no } from 'shared/util'
import { isNonPhrasingTag } from 'web/compiler/util'

// 匹配的过程中利用的正则表达式，通过这些，我们可以匹配注释节点、文档类型节点、开始闭合标签等
// Regular Expressions for parsing tags and attributes
const attribute = /^\s*([^\s"'<>\/=]+)(?:\s*(=)\s*(?:"([^"]*)"+|'([^']*)'+|([^\s"'=<>`]+)))?/
// could use https://www.w3.org/TR/1999/REC-xml-names-19990114/#NT-QName
// but for Vue templates we can enforce a simple charset
const ncname = '[a-zA-Z_][\\w\\-\\.]*'
const qnameCapture = `((?:${ncname}\\:)?${ncname})`
const startTagOpen = new RegExp(`^<${qnameCapture}`)
const startTagClose = /^\s*(\/?)>/
const endTag = new RegExp(`^<\\/${qnameCapture}[^>]*>`)
const doctype = /^<!DOCTYPE [^>]+>/i
// #7298: escape - to avoid being pased as HTML comment when inlined in page
const comment = /^<!\--/
const conditionalComment = /^<!\[/

let IS_REGEX_CAPTURING_BROKEN = false
'x'.replace(/x(.)?/g, function (m, g) {
  IS_REGEX_CAPTURING_BROKEN = g === ''
})

// Special Elements (can contain anything)
export const isPlainTextElement = makeMap('script,style,textarea', true)
const reCache = {}

const decodingMap = {
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&amp;': '&',
  '&#10;': '\n',
  '&#9;': '\t'
}
const encodedAttr = /&(?:lt|gt|quot|amp);/g
const encodedAttrWithNewLines = /&(?:lt|gt|quot|amp|#10|#9);/g

// #5992
const isIgnoreNewlineTag = makeMap('pre,textarea', true)
const shouldIgnoreFirstNewline = (tag, html) => tag && isIgnoreNewlineTag(tag) && html[0] === '\n'

function decodeAttr (value, shouldDecodeNewlines) {
  const re = shouldDecodeNewlines ? encodedAttrWithNewLines : encodedAttr
  return value.replace(re, match => decodingMap[match])
}

export function parseHTML (html, options) {
  const stack = []
  const expectHTML = options.expectHTML
  const isUnaryTag = options.isUnaryTag || no
  const canBeLeftOpenTag = options.canBeLeftOpenTag || no
  let index = 0
  let last, lastTag
  while (html) {    // 循环解析template，用正则做各种匹配，直至整个template被解析完毕
    last = html 
    // Make sure we're not in a plaintext content element like script/style
    if (!lastTag || !isPlainTextElement(lastTag)) {
      let textEnd = html.indexOf('<')
      if (textEnd === 0) {
        // Comment:
        // 对于注释和条件注释节点，前进至它们的末尾位置
        if (comment.test(html)) {
          const commentEnd = html.indexOf('-->')

          if (commentEnd >= 0) {
            if (options.shouldKeepComment) {
              options.comment(html.substring(4, commentEnd))
            }
            advance(commentEnd + 3)
            continue
          }
        }

        // http://en.wikipedia.org/wiki/Conditional_comment#Downlevel-revealed_conditional_comment
        if (conditionalComment.test(html)) {
          const conditionalEnd = html.indexOf(']>')

          if (conditionalEnd >= 0) {
            advance(conditionalEnd + 2)
            continue
          }
        }

        // Doctype:
        // 对于文档类型节点，前进它自身长度的距离
        const doctypeMatch = html.match(doctype)
        if (doctypeMatch) {
          advance(doctypeMatch[0].length)
          continue
        }

        // End tag:
        // 闭合标签
        const endTagMatch = html.match(endTag)    // 先通过正则匹配到闭合标签
        if (endTagMatch) {
          const curIndex = index
          advance(endTagMatch[0].length)      // 前进到闭合标签末尾
          parseEndTag(endTagMatch[1], curIndex, index)    // 对闭合标签做解析
          continue
        }

        // Start tag:
        // 开始标签
        const startTagMatch = parseStartTag()
        if (startTagMatch) {
          handleStartTag(startTagMatch)   // 对match做处理
          if (shouldIgnoreFirstNewline(lastTag, html)) {
            advance(1)
          }
          continue
        }
      }

      // 文本
      let text, rest, next
      if (textEnd >= 0) {   // 判断textEnd是否大于等于0，满足则说明从当前位置到textEnd位置都是文本
        rest = html.slice(textEnd)
        while (
          !endTag.test(rest) &&
          !startTagOpen.test(rest) &&
          !comment.test(rest) &&
          !conditionalComment.test(rest)
        ) {
          // < in plain text, be forgiving and treat it as text
          next = rest.indexOf('<', 1)   // 若<是纯文本中的字符，就继续找到真正的文本结束的位置，然后前进到结束的位置
          if (next < 0) break
          textEnd += next
          rest = html.slice(textEnd)
        }
        text = html.substring(0, textEnd)
        advance(textEnd)
      }

      if (textEnd < 0) {    // 说明整个template解析完毕，把剩余的html都赋值给text
        text = html
        html = ''
      }

      if (options.chars && text) {
        options.chars(text)
      }
    } else {
      let endTagLength = 0
      const stackedTag = lastTag.toLowerCase()
      const reStackedTag = reCache[stackedTag] || (reCache[stackedTag] = new RegExp('([\\s\\S]*?)(</' + stackedTag + '[^>]*>)', 'i'))
      const rest = html.replace(reStackedTag, function (all, text, endTag) {
        endTagLength = endTag.length
        if (!isPlainTextElement(stackedTag) && stackedTag !== 'noscript') {
          text = text
            .replace(/<!\--([\s\S]*?)-->/g, '$1') // #7298
            .replace(/<!\[CDATA\[([\s\S]*?)]]>/g, '$1')
        }
        if (shouldIgnoreFirstNewline(stackedTag, text)) {
          text = text.slice(1)
        }
        if (options.chars) {
          options.chars(text)
        }
        return ''
      })
      index += html.length - rest.length
      html = rest
      parseEndTag(stackedTag, index - endTagLength, index)
    }

    if (html === last) {
      options.chars && options.chars(html)
      if (process.env.NODE_ENV !== 'production' && !stack.length && options.warn) {
        options.warn(`Mal-formatted tag at end of template: "${html}"`)
      }
      break
    }
  }

  // Clean up any remaining tags
  parseEndTag()

  // 匹配过程中，利用advance函数不断前进整个模板字符串，直到字符串末尾
  function advance (n) {
    index += n
    html = html.substring(n)
  }

  function parseStartTag () {
    const start = html.match(startTagOpen)    // 先通过正则startTagOpen匹配到开始标签
    if (start) {
      const match = {       // 定义match对象
        tagName: start[1],
        attrs: [],
        start: index
      }
      advance(start[0].length)
      let end, attr
      // 循环去匹配开始标签中的属性并添加到match.attrs中，直到匹配的开始标签的闭合符结束 
      while (!(end = html.match(startTagClose)) && (attr = html.match(attribute))) {
        advance(attr[0].length)
        match.attrs.push(attr)
      }
      if (end) {  // 若匹配到闭合符，则获取一元斜线符，前进道闭合符尾，并把当前索引赋值给match.end
        match.unarySlash = end[1]
        advance(end[0].length)
        match.end = index
        return match
      }
    }
  }

  // 对开始标签做解析
  function handleStartTag (match) {
    const tagName = match.tagName
    const unarySlash = match.unarySlash

    if (expectHTML) {
      if (lastTag === 'p' && isNonPhrasingTag(tagName)) {
        parseEndTag(lastTag)
      }
      if (canBeLeftOpenTag(tagName) && lastTag === tagName) {
        parseEndTag(tagName)
      }
    }

    const unary = isUnaryTag(tagName) || !!unarySlash     // 判断开始标签是否是一元标签，类似<img>、<br/>

    const l = match.attrs.length
    const attrs = new Array(l)
    for (let i = 0; i < l; i++) {     // 接着对match.attrs遍历并做了一些处理
      const args = match.attrs[i]
      // hackish work around FF bug https://bugzilla.mozilla.org/show_bug.cgi?id=369778
      if (IS_REGEX_CAPTURING_BROKEN && args[0].indexOf('""') === -1) {
        if (args[3] === '') { delete args[3] }
        if (args[4] === '') { delete args[4] }
        if (args[5] === '') { delete args[5] }
      }
      const value = args[3] || args[4] || args[5] || ''
      const shouldDecodeNewlines = tagName === 'a' && args[1] === 'href'
        ? options.shouldDecodeNewlinesForHref
        : options.shouldDecodeNewlines
      attrs[i] = {
        name: args[1],
        value: decodeAttr(value, shouldDecodeNewlines)
      }
    }
    // 若非一元标签，则往stack里push一个对象 
    if (!unary) {
      stack.push({ tag: tagName, lowerCasedTag: tagName.toLowerCase(), attrs: attrs })
      lastTag = tagName
    }

    if (options.start) {
      options.start(tagName, attrs, unary, match.start, match.end)
    }
  }

  // 对闭合标签做解析
  function parseEndTag (tagName, start, end) {
    let pos, lowerCasedTagName
    if (start == null) start = index
    if (end == null) end = index

    if (tagName) {
      lowerCasedTagName = tagName.toLowerCase()
    }

    // Find the closest opened tag of the same type
    if (tagName) {      // 倒序stack，找到第一个和当前endTag匹配的元素
      for (pos = stack.length - 1; pos >= 0; pos--) {
        if (stack[pos].lowerCasedTag === lowerCasedTagName) {
          break
        }
      }
    } else {
      // If no tag name is provided, clean shop
      pos = 0
    }

    if (pos >= 0) {
      // Close all the open elements, up the stack
      for (let i = stack.length - 1; i >= pos; i--) {
        if (process.env.NODE_ENV !== 'production' &&
          (i > pos || !tagName) &&
          options.warn
        ) {
          options.warn(
            `tag <${stack[i].tag}> has no matching end tag.`
          )
        }
        if (options.end) {
          options.end(stack[i].tag, start, end)
        }
      }

      // Remove the open elements from the stack
      stack.length = pos
      lastTag = pos && stack[pos - 1].tag
    } else if (lowerCasedTagName === 'br') {
      if (options.start) {
        options.start(tagName, [], true, start, end)
      }
    } else if (lowerCasedTagName === 'p') {
      if (options.start) {
        options.start(tagName, [], false, start, end)
      }
      if (options.end) {
        options.end(tagName, start, end)
      }
    }
  }
}
