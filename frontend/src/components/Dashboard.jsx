import React, { useState } from 'react';
import '../App.css';

const Dashboard = () => {
    // Set Volatility 100 Index as the default placeholder [cite: 10]
    const [selectedAsset, setSelectedAsset] = useState('R_100');
    const [signalData, setSignalData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // Hardcoded subset of 80+ assets for demo [cite: 9]
    const assets = [
        { id: 'R_100', name: 'Volatility 100 Index' },
        { id: 'R_75', name: 'Volatility 75 Index' },
        { id: 'R_50', name: 'Volatility 50 Index' },
        { id: 'R_25', name: 'Volatility 25 Index' },
        { id: 'R_10', name: 'Volatility 10 Index' }
    ];

    const handleAnalyze = async () => {
        setLoading(true);
        setError('');
        setSignalData(null);

        try {
            const response = await fetch(`http://localhost:5000/api/analyze/${selectedAsset}`);
            const data = await response.json();

            if (!response.ok) {
                // Handle WebSocket disconnects or unavailable data [cite: 32, 33]
                throw new Error(data.error || 'Market data unavailable'); 
            }

            setSignalData(data);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="dashboard-container">
            <h2>Deriv Signal Dashboard</h2>
            
            <div className="header-controls">
                <select 
                    value={selectedAsset} 
                    onChange={(e) => setSelectedAsset(e.target.value)}
                >
                    {assets.map(asset => (
                        <option key={asset.id} value={asset.id}>
                            {asset.name}
                        </option>
                    ))}
                </select>

                <button 
                    className="analyze-btn" 
                    onClick={handleAnalyze} 
                    disabled={loading || error.includes('Reconnecting')}
                >
                    {loading ? 'Analyzing...' : 'Analyze'} 
                </button>
            </div>

            {error && <div className="error-toast">⚠ {error}</div>}

            {/* Signal Output Display [cite: 12] */}
            {signalData && (
                <div className="signal-card">
                    {signalData.direction === 'BUY' && <div className="signal-buy">BUY SIGNAL</div>}
                    {signalData.direction === 'SELL' && <div className="signal-sell">SELL SIGNAL</div>}
                    {!signalData.direction && <div className="signal-hold">{signalData.status}</div>}

                    {signalData.direction && (
                        <div className="data-grid">
                            <div className="data-item">
                                <div className="data-label">ENTRY PRICE</div>
                                <div className="data-value">{signalData.entry}</div> 
                            </div>
                            <div className="data-item">
                                <div className="data-label">TAKE PROFIT (TP)</div>
                                <div className="data-value">{signalData.tp}</div>
                            </div>
                            <div className="data-item">
                                <div className="data-label">STOP LOSS (SL)</div>
                                <div className="data-value">{signalData.sl}</div>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default Dashboard;
