import { useState } from 'react'

export function PermissionPopover() {
  const [allowFullAccess, setAllowFullAccess] = useState(false)

  return (
    <div className="p-4 w-[280px]">
      <p className="text-sm text-gray-600 leading-relaxed mb-4">
        当前为默认权限，所有操作都会在安全沙箱约束内进行，超出范围会请求你的允许。
      </p>
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-700 font-medium">允许完全访问</span>
        <button
          onClick={() => setAllowFullAccess(!allowFullAccess)}
          className={`relative w-11 h-6 rounded-full transition-colors ${
            allowFullAccess ? 'bg-blue-500' : 'bg-gray-300'
          }`}
        >
          <span
            className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
              allowFullAccess ? 'translate-x-5' : ''
            }`}
          />
        </button>
      </div>
    </div>
  )
}
