/* Settings go here */
import { useState } from "react";
import './Settings.css';
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
    }
    return (
    <div className="settings-container">
      <section className="settings-card">
        <h1 className="settings-heading">Group Settings</h1>

        {/* Group Name */}
        <div>
          <br />
          <input
            className="settings-input"
            type="text"
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            placeholder="Enter group name"
          />
        </div>

        {/* Split Type */}
        <div>
          <br />
          <select
            className="settings-selection"
            value={splitType}
            onChange={(e) => setSplitType(e.target.value)}
          >
            <option value="equal">Equal Split</option>
            <option value="custom">Custom Amounts</option>
          </select>
        </div>

        {/* Exclusions */}
        <div>
          <label  className="settings-subtitle">
            <input
              type="checkbox"
              checked={allowExclusions}
              onChange={() => setAllowExclusions(!allowExclusions)}
            />
            Allow excluding members from payments
          </label>
        </div>

        {/* Save Button */}
        <button   
          type="submit"
          className="settings-button" 
          onClick={handleSave}>
            
          Save Settings
        </button>

        {/* Back Button */}
        <button className="settings-button" onClick={() => navigate('/')}>
          Back
        </button>
      </section>
    </div>
  )
}
export default Settings;
