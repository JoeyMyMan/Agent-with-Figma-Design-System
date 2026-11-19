// 演示用：这里故意写死一个颜色，门禁应该拦下它（教程第 6 步会把这里改成 token）
export function LoginButton() {
  return (
    <button
      style={{
        background: '#7C4DFF', // ✗ 硬编码颜色：应改用 var(--xhx-color-primary-action)
        color: 'var(--xhx-color-on-action)',
        borderRadius: 'var(--xhx-radius-m)',
        height: 'var(--xhx-height-btn-m)',
      }}
    >
      登录
    </button>
  )
}
