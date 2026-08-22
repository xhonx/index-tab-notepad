import '../src/assets/main.css'
import IndexTab from './components/IndexTab'

function App(): React.JSX.Element {
  return (
    <div style={{ display: 'flex', width: '100%', height: '100%' }}>
      <div style={{ flex: 1 }}>{/* 패널 영역 - 다음 단계에서 채움 */}</div>
      <IndexTab />
    </div>
  )
}

export default App
