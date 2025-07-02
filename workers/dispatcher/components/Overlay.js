import React from 'react';

const Overlay = ({ message }) => {
    if (!message) return null;

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1000,
            color: 'white',
            fontSize: '18px',
            textAlign: 'center',
            padding: '20px'
        }}>
            <div style={{
                backgroundColor: message.success ? '#4CAF50' : '#2196F3',
                padding: '20px 40px',
                borderRadius: '10px',
                boxShadow: '0 4px 8px rgba(0, 0, 0, 0.3)',
                maxWidth: '500px',
                width: '90%'
            }}>
                {typeof message.text === 'string' ? message.text : message.text}
            </div>
        </div>
    );
};

export default Overlay;
