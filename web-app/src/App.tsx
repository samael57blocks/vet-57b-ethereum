import './App.css'
import { Outlet } from 'react-router-dom'
import NavBar from './common/components/NavBar'

function App() {
  return (
    <div className="app-container">
      <div className="glow-orb" />
      <NavBar />
      <Outlet />
    </div>
  );
}

export function MainPage() {
  return (
    <main className="main-content">
      <h1>Welcome to 57B Vet</h1>
      <h2>Technical Test</h2>
      <p>You can find all the patients for the veterinary clinic and their information here.
      </p>
      <p>
        You can also add new patients and edit their information.
      </p>
      <p>
        You can also delete patients and their information.
      </p>
      <p>
        You can also search for patients and their information.
      </p>
    </main>
  );
}

export default App
