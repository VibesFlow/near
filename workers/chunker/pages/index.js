import Head from 'next/head';
import styles from '../styles/Home.module.css';
import { useState, useEffect } from 'react';
import Overlay from '../components/Overlay';

const contractId = process.env.NEXT_PUBLIC_contractId;

export default function ChunkerAgent() {
    const [message, setMessage] = useState('');
    const [accountId, setAccountId] = useState();
    const [balance, setBalance] = useState(0);
    const [error, setError] = useState('');

    const setMessageHide = async (message, dur = 3000, success = false) => {
        setMessage({ text: message, success });
        await new Promise(r => setTimeout(r, dur));
        setMessage('');
    };

    const getWorkerDetails = async () => {
        try {
            const res = await fetch('/api/getWorkerAccount').then((r) => r.json());
            if (res.error) {
                console.log('Error getting worker account:', res.error);
                setError('Failed to get worker account details');
                return;
            }
            setAccountId(res.accountId);
            setBalance(res.balance ? (parseFloat(res.balance) / 1e24).toFixed(4) : '0');
        } catch (error) {
            console.log('Error fetching worker details:', error);
            setError('Failed to fetch worker account details');
        }
    };

    useEffect(() => {
        getWorkerDetails();
    }, []);

    return (
        <div className={styles.container}>
            <Head>
                <title>VibesFlow Chunker Agent</title>
                <link rel="icon" href="/favicon.ico" />
            </Head>
            <Overlay message={message} />

            <main className={styles.main}>
                <h1 className={styles.title}>VibesFlow Chunker Agent</h1>
                <div className={styles.subtitleContainer}>
                    <h2 className={styles.subtitle}>Audio Chunking Worker</h2>
                </div>
                <p>
                    This worker handles 60-second audio chunking with VRF-based ownership raffles.
                </p>

                <div className={styles.grid}>
                    <div className={styles.card}>
                        <h3>Worker Account</h3>
                        <p>
                            Account ID: {accountId || 'Loading...'}
                            <br />
                            Balance: {balance} NEAR
                            <br />
                            Contract: {contractId}
                        </p>
                    </div>

                    <a
                        href="#"
                        className={styles.card}
                        onClick={async () => {
                            setMessage({ 
                                text: 'Registering Worker',
                                success: true
                            });

                            try {
                                const res = await fetch('/api/register').then(
                                    (r) => r.json(),
                                );
                                
                                setMessageHide(
                                    `Registration: ${JSON.stringify(res.registered)}`,
                                    3000,
                                    true
                                );
                            } catch (e) {
                                console.error(e);
                                setMessageHide(
                                    `Error: ${e.message}`,
                                    3000,
                                    false
                                );
                            }
                        }}
                    >
                        <h3>Register Worker</h3>
                        <p>Register this worker with the agent contract</p>
                    </a>

                    <a
                        href="#"
                        className={styles.card}
                        onClick={async () => {
                            setMessage({ 
                                text: 'Testing VRF Raffle...',
                                success: false
                            });

                            try {
                                const res = await fetch('/api/testVRF').then((r) => r.json());
                                setMessageHide(
                                    `VRF test: ${res.success ? 'Success' : 'Failed'}`,
                                    3000,
                                    res.success
                                );
                            } catch (e) {
                                console.error(e);
                                setMessageHide(
                                    `Error: ${e.message}`,
                                    3000,
                                    false
                                );
                            }
                        }}
                    >
                        <h3>Test VRF</h3>
                        <p>Test VRF raffle system</p>
                    </a>

                    <div className={styles.card}>
                        <h3>Chunk Status</h3>
                        <p>
                            Chunk Duration: 60 seconds
                            <br />
                            Sample Rate: 44.1kHz
                            <br />
                            Active Streams: 0
                        </p>
                    </div>
                </div>
            </main>

            <footer className={styles.footer}>
                <p>VibesFlow Chunker Agent - Powered by NEAR Shade Agents</p>
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
