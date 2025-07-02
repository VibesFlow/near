import Head from 'next/head';
import styles from '../styles/Home.module.css';
import { useState, useEffect } from 'react';
import Overlay from '../components/Overlay';

const contractId = process.env.NEXT_PUBLIC_contractId;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export default function Home() {
    const [message, setMessage] = useState('');
    const [accountId, setAccountId] = useState();
    const [balance, setBalance] = useState(0);
    const [storageMetrics, setStorageMetrics] = useState(null);
    const [uploadFile, setUploadFile] = useState(null);
    const [uploadResult, setUploadResult] = useState(null);
    const [error, setError] = useState('');

    const setMessageHide = async (message, dur = 3000, success = false) => {
        setMessage({ text: message, success });
        await sleep(dur);
        setMessage('');
    };

    const getWorkerDetails = async () => {
            const res = await fetch('/api/getWorkerAccount').then((r) => r.json());
            if (res.error) {
                console.log('Error getting worker account:', res.error);
                setError('Failed to get worker account details');
                return;
            }
            setAccountId(res.accountId);
        setBalance((parseFloat(res.balance) / 1e24).toFixed(4));
    };

    const getStorageMetrics = async () => {
        try {
            const res = await fetch('/api/getStorageMetrics').then((r) => r.json());
            if (res.error) {
                console.log('Error getting storage metrics:', res.error);
                setError('Failed to get storage metrics');
                return;
            }
            setStorageMetrics(res.metrics);
        } catch (error) {
            console.log('Error fetching storage metrics:', error);
            setError('Failed to fetch storage metrics');
        }
    };

    const handleFileUpload = async () => {
        if (!uploadFile) {
            setMessageHide('Please select a file to upload', 3000);
            return;
        }

        setMessage({ text: 'Uploading file to Synapse storage...', success: false });

        try {
            const formData = new FormData();
            formData.append('file', uploadFile);

            const res = await fetch('/api/uploadFile', {
                method: 'POST',
                body: formData,
            });

            const result = await res.json();

            if (result.success) {
                setUploadResult(result.upload);
                setMessageHide(
                    <>
                        <p>File uploaded successfully!</p>
                        <p>CID: {result.upload.cid}</p>
                    </>,
                    5000,
                    true
                );
            } else {
                setMessageHide('Upload failed: ' + result.error, 5000);
            }
        } catch (error) {
            console.error('Upload error:', error);
            setMessageHide('Upload failed: ' + error.message, 5000);
        }
    };

    useEffect(() => {
        getWorkerDetails();
        getStorageMetrics();
        
        const interval = setInterval(() => {
            getStorageMetrics();
        }, 30000); // Refresh every 30 seconds
        
        return () => clearInterval(interval);
    }, []);

    return (
        <div className={styles.container}>
            <Head>
                <title>VibesFlow Dispatcher Worker</title>
                <link rel="icon" href="/favicon.ico" />
            </Head>
            <Overlay message={message} />

            <main className={styles.main}>
                <h1 className={styles.title}>VibesFlow Dispatcher Worker</h1>
                <div className={styles.subtitleContainer}>
                    <h2 className={styles.subtitle}>Powered by Shade Agents & Synapse Storage</h2>
                </div>
                <p>
                    This dispatcher worker handles file uploads to Filecoin storage using the Synapse SDK with USDFC payments.
                </p>
                <ol>
                    <li>Fund the worker agent with testnet NEAR tokens (0.3 will do)</li>
                    <li>Ensure USDFC balance is sufficient for storage operations</li>
                    <li>Register the worker agent in the NEAR smart contract</li>
                    <li>Upload files to distributed storage with automatic CDN</li>
                </ol>

                {storageMetrics && (
                    <div style={{ 
                        background: '#f5f5f5', 
                        padding: '1.25rem', 
                        borderRadius: '10px',
                        marginBottom: '1rem',
                        textAlign: 'center',
                        maxWidth: '450px',
                        border: '1px solid #e0e0e0',
                        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05)'
                    }}>
                        <h3 style={{ 
                            margin: '0 0 0.5rem 0',
                            color: '#666',
                            fontSize: '1.1rem'
                        }}>Storage Service Status</h3>
                        <p style={{ fontSize: '0.9rem', margin: '0.5rem 0' }}>
                            Wallet USDFC: {storageMetrics.balances.wallet}
                        </p>
                        <p style={{ fontSize: '0.9rem', margin: '0.5rem 0' }}>
                            Payments Contract: {storageMetrics.balances.payments}
                        </p>
                        <p style={{ fontSize: '0.9rem', margin: '0.5rem 0' }}>
                            Storage Capacity: {storageMetrics.storageConfig.storageCapacity} GB
                        </p>
                        <p style={{ fontSize: '0.9rem', margin: '0.5rem 0' }}>
                            CDN Enabled: {storageMetrics.storageConfig.withCDN ? 'Yes' : 'No'}
                        </p>
                    </div>
                )}

                {uploadResult && (
                    <div style={{ 
                        marginBottom: '1.5rem',
                        textAlign: 'center',
                        maxWidth: '450px',
                        background: '#e8f5e8',
                        padding: '1rem',
                        borderRadius: '8px'
                    }}>
                        <h4>Last Upload Result</h4>
                        <p style={{ fontSize: '0.9rem', margin: '0.5rem 0' }}>
                            File: {uploadResult.filename}
                        </p>
                        <p style={{ fontSize: '0.9rem', margin: '0.5rem 0' }}>
                            CID: {uploadResult.cid}
                        </p>
                        <p style={{ fontSize: '0.9rem', margin: '0.5rem 0' }}>
                            Size: {(uploadResult.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                        {uploadResult.url && (
                            <a 
                                href={uploadResult.url} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                style={{ 
                                    color: '#0070f3', 
                                    textDecoration: 'none',
                                    fontSize: '0.9rem'
                                }}
                            >
                                View File →
                            </a>
                        )}
                    </div>
                )}

                <div className={styles.grid}>
                    <div className={styles.card}>
                        <h3>Step 1.</h3>
                        <p>
                            Fund Worker Agent account:
                            <br />
                            <br />
                            {accountId?.length >= 24
                                ? `${accountId.substring(0, 10)}...${accountId.substring(accountId.length - 4)}`
                                : accountId}
                            <br />
                            <button
                                className={styles.btn}
                                onClick={() => {
                                    try {
                                        if(navigator.clipboard && navigator.clipboard.writeText) {
                                            navigator.clipboard.writeText(accountId);
                                            setMessageHide('Copied', 500, true);
                                        } else {
                                            setMessageHide('Clipboard not supported', 3000, true);
                                        }
                                    } catch (e) {
                                        setMessageHide('Copy failed', 3000, true);
                                    }
                                }}
                            >
                                copy
                            </button>
                            <br />
                            <br />
                            balance: {balance} NEAR
                            <br />
                            <a 
                                href="https://near-faucet.io/" 
                                target="_blank" 
                                rel="noopener noreferrer"
                                style={{ 
                                    color: '#0070f3', 
                                    textDecoration: 'none',
                                    fontSize: '0.9rem'
                                }}
                            >
                                Get Testnet NEAR tokens from faucet →
                            </a>
                        </p>
                    </div>

                    <div className={styles.card}>
                        <h3>Step 2.</h3>
                        <p>
                            USDFC Balance Status:
                            <br />
                            <br />
                            {storageMetrics ? (
                                <>
                                    Wallet: {storageMetrics.balances.wallet} USDFC
                                    <br />
                                    Contract: {storageMetrics.balances.payments} USDFC
                                    <br />
                                    <br />
                                    <button
                                        className={styles.btn}
                                        onClick={getStorageMetrics}
                                    >
                                        Refresh
                                    </button>
                                    <br />
                                    <a 
                                        href="https://faucet.quicknode.com/filecoin" 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        style={{ 
                                            color: '#0070f3', 
                                            textDecoration: 'none',
                                            fontSize: '0.9rem'
                                        }}
                                    >
                                        Get test FIL/USDFC →
                                    </a>
                                </>
                            ) : (
                                'Loading...'
                            )}
                        </p>
                    </div>

                    <a
                        href="#"
                        className={styles.card}
                        onClick={async () => {
                            if (process.env.NODE_ENV !== 'production') {
                                setMessageHide(
                                    <>
                                        <p>Registration not needed in development mode</p>
                                        <p className={styles.code}>
                                            TEE operations are only available in production
                                        </p>
                                    </>,
                                    3000,
                                    true
                                );
                                return;
                            }

                            setMessage({ 
                                text: 'Registering Worker',
                                success: true
                            });

                            try {
                                const res = await fetch('/api/register').then(
                                    (r) => r.json(),
                                );
                                
                                setMessageHide(
                                    <>
                                        <p>register_worker response:</p>
                                        <p className={styles.code}>
                                            registered: {JSON.stringify(res.registered)}
                                        </p>
                                    </>,
                                    3000,
                                    true
                                );
                            } catch (e) {
                                console.error(e);
                                setMessageHide(
                                    <>
                                        <p>Error registering worker:</p>
                                        <p className={styles.code}>
                                            {e.message || 'An unexpected error occurred'}
                                        </p>
                                    </>,
                                    3000,
                                    true
                                );
                            }
                        }}
                    >
                        <h3>Step 3.</h3>
                        <p>
                            Register the Worker Agent in the smart contract:
                            <br />
                            <br />
                            {contractId}
                        </p>
                    </a>

                    <div className={styles.card}>
                        <h3>Step 4.</h3>
                        <p>Upload File to Storage:</p>
                        <br />
                        <input
                            type="file"
                            onChange={(e) => setUploadFile(e.target.files[0])}
                            style={{ margin: '10px 0' }}
                        />
                            <br />
                        <button
                            className={styles.btn}
                            onClick={handleFileUpload}
                            disabled={!uploadFile}
                        >
                            Upload to Synapse
                        </button>
                            <br />
                        <p className={styles.code}>
                            Upload files to distributed Filecoin storage with CDN
                        </p>
                    </div>
                </div>
            </main>

            <footer className={styles.footer}>
                <a
                    href="https://vibesflow.co"
                    target="_blank"
                    rel="noopener noreferrer"
                >
                    VibesFlow Dispatcher Worker
                </a>
            </footer>
            {error && (
                <div style={{
                    position: 'fixed',
                    bottom: '20px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    background: '#ff4444',
                    color: 'white',
                    padding: '10px 20px',
                    borderRadius: '5px',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                    zIndex: 1000
                }}>
                    {error}
                </div>
            )}
        </div>
    );
}
