import '@testing-library/jest-dom/vitest'
import { afterEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'

// jsdom 未实现 scrollIntoView，组件内 messagesEndRef / mentionListRef 会调用它
Element.prototype.scrollIntoView = vi.fn() as unknown as Element['scrollIntoView']

afterEach(() => {
  cleanup()
})
