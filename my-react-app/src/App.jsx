import { Routes, Route } from 'react-router-dom'
import './App.css'
import Landing from './Landing'
import SignIn from './SignIn'
import SignUp from './SignUp'
import Settings from './Settings'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/settings" element={<Settings />} />
      <Route path="/signin" element={<SignIn />} />
      <Route path="/signup" element={<SignUp />} />
      <Route path="/landing" element={<Landing />} />
    </Routes>
  )
}

export default App
