// 顶栏组件：颜色与间距走 token，尺寸可以写 px（组件库里 px 由门禁拦）
export function TopBar() {
  return (
    <header className="xhx-topbar">
      <span className="xhx-topbar__tab" aria-selected="true">首页</span>
      <span className="xhx-topbar__tab">应用</span>
      <span className="xhx-topbar__tab">任务</span>
    </header>
  )
}
