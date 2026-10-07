import React, { useState, useEffect } from 'react';
import { Key, Copy, Download, X } from 'lucide-react';
import { get } from 'idb-keyval';

export const KeyVaultModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [privateKey, setPrivateKey] = useState<string>('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const loadKey = async () => {
      try {
        const keys = await get('officer_keys');
        if (keys && keys.privateKey) {
          setPrivateKey(JSON.stringify(keys.privateKey, null, 2));
        }
      } catch (e) {
        console.error('Failed to load keys', e);
      }
    };
    loadKey();
  }, []);

  const handleCopy = () => {
    navigator.clipboard.writeText(privateKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([privateKey], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'raksha_private_key.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--ink)]/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden border border-[var(--line)]">
        <div className="flex justify-between items-center p-5 border-b border-[var(--line)] bg-[var(--paper-2)]">
          <h2 className="font-display font-bold text-[18px] text-[var(--ink)] flex items-center gap-2">
            <Key className="w-5 h-5 text-[var(--saffron)]" /> Secure Key Vault
          </h2>
          <button onClick={onClose} className="text-[var(--ink-soft)] hover:text-[var(--ink)] transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 font-body">
          <p className="text-[13px] text-[var(--ink-soft)] mb-4">
            This is your End-to-End Encryption private key. <strong>Do not share it with anyone.</strong> You will need this key to log in from other devices or if you clear your browser data.
          </p>
          <div className="relative mb-6">
            <textarea
              readOnly
              value={privateKey || 'Loading...'}
              className="w-full h-40 p-4 font-mono text-[11px] bg-[var(--paper)] border border-[var(--line-strong)] rounded-lg text-[var(--ink)] focus:outline-none resize-none"
            />
          </div>
          <div className="flex gap-3 justify-end">
            <button 
              onClick={handleCopy}
              className="px-4 py-2 border border-[var(--line-strong)] bg-white text-[13px] font-bold rounded-lg flex items-center gap-2 hover:bg-[var(--paper-2)] transition-colors"
            >
              <Copy className="w-4 h-4" /> {copied ? 'Copied!' : 'Copy to Clipboard'}
            </button>
            <button 
              onClick={handleDownload}
              className="px-4 py-2 bg-[var(--ink)] text-white text-[13px] font-bold rounded-lg flex items-center gap-2 hover:bg-[var(--ink-soft)] transition-colors shadow-sm"
            >
              <Download className="w-4 h-4" /> Download Key File
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
