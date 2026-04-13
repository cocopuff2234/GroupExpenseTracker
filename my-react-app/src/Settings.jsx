/* Settings go here */
import { useState } from "react";
import './App.css'
import { useNavigate } from 'react-router-dom'

function Settings(){
    /* Consts for the Group Name (people spliting the pay), Split Type (equal, custom), and exclusions.
    This is all pulled from the description of the settings page in the project proposal document. */
    const [groupName, setGroupName] = useState('')
    const [splitType, setSplitType] = useState('equal')
    const [allowExclusions, setAllowExclusions] = useState(false)
    const navigate = useNavigate()

    const handleSave = () => {
        const settings = {
            groupName,
            splitType,
            allowExclusions,
        }
        console.log('Saved settings:', settings)
        alert('Settings saved!')
    }
    return (
    <section id="center">
      <h1>Group Settings</h1>

      {/* Group Name */}
      <div>
        <label>Group Name</label>
        <br />
        <input
          type="text"
          value={groupName}
          onChange={(e) => setGroupName(e.target.value)}
          placeholder="Enter group name"
        />
      </div>

      {/* Split Type */}
      <div>
        <label>Split Method</label>
        <br />
        <select
          value={splitType}
          onChange={(e) => setSplitType(e.target.value)}
        >
          <option value="equal">Equal Split</option>
          <option value="custom">Custom Amounts</option>
        </select>
      </div>

      {/* Exclusions */}
      <div>
        <label>
          <input
            type="checkbox"
            checked={allowExclusions}
            onChange={() => setAllowExclusions(!allowExclusions)}
          />
          Allow excluding members from payments
        </label>
      </div>

      {/* Save Button */}
      <button className="counter" onClick={handleSave}>
        Save Settings
      </button>

      {/* Back Button */}
      <button className="counter" onClick={() => navigate('/')}>
        Back
      </button>
    </section>
  )
}
export default Settings