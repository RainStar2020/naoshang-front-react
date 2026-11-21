import './utils/cryptoPolyfill'
import dayjs from 'dayjs'
import 'dayjs/locale/zh-cn'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles/global.css'

dayjs.locale('zh-cn')

ReactDOM.createRoot(document.getElementById('root')!).render(<App />)
