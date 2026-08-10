import React, { useState, useRef } from 'react';
import { X, Moon, Sun, ShieldCheck, Mail, Phone, Award, Edit2, Camera, Save, LogOut, Download, AlertCircle, Loader2, AlertTriangle } from 'lucide-react';
import { UserProfile } from '../../types';
import { authFetch } from '../../lib/api';
import { ConfirmDialog } from '../ui/ConfirmDialog';

interface ClientProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  userProfile: UserProfile;
  onUpdateProfile?: (profile: UserProfile) => void;
  onLogout?: () => void;
}

export const ClientProfileModal: React.FC<ClientProfileModalProps> = ({
  isOpen,
  onClose,
  userProfile,
  onUpdateProfile,
  onLogout
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showDeleteAccountConfirm, setShowDeleteAccountConfirm] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  
  const [formData, setFormData] = useState({
    name: userProfile?.name || '',
    email: userProfile?.email || '',
    phone: userProfile?.phone || '',
    avatar_url: userProfile?.avatar_url || ''
  });
  
  React.useEffect(() => {
    if (isOpen && userProfile) {
      setFormData({
        name: userProfile.name || '',
        email: userProfile.email || '',
        phone: userProfile.phone || '',
        avatar_url: userProfile.avatar_url || userProfile.avatarUrl || ''
      });
      setIsEditing(false);
      setErrorMsg('');
      setSuccessMsg('');
    }
  }, [isOpen, userProfile]);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen || !userProfile) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    setIsSaving(true);
    
    try {
      // Validate phone length
      const phoneDigits = formData.phone.replace(/\D/g, '');
      if (phoneDigits.length > 0 && phoneDigits.length < 10) {
        throw new Error("Telefone inválido. Digite o DDD e o número.");
      }

      let updatedProfileData = {
        ...userProfile,
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        avatar_url: formData.avatar_url,
        avatarUrl: formData.avatar_url
      };

      if (userProfile.id !== 'usr_mock') {
        const res = await authFetch(`/api/profiles/${userProfile.id}`, {
          method: 'PUT',
          body: JSON.stringify({
            name: formData.name,
            email: formData.email,
            phone: formData.phone,
            avatar_url: formData.avatar_url
          })
        });

        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || 'Erro ao atualizar dados. O E-mail/Telefone já pode estar em uso.');
        }

        const serverData = await res.json();
        if (serverData) {
          updatedProfileData = { ...updatedProfileData, ...serverData };
        }
      }

      if (onUpdateProfile) {
        onUpdateProfile(updatedProfileData);
      }
      
      setSuccessMsg('Perfil atualizado com sucesso!');
      setTimeout(() => {
        setIsEditing(false);
        setSuccessMsg('');
      }, 1500);

    } catch (err: any) {
      console.warn(err);
      setErrorMsg(err.message || 'Falha ao salvar. Verifique sua conexão e tente novamente.');
    } finally {
      setIsSaving(false);
    }
  };
  
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData({ ...formData, avatar_url: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-surface-base/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="w-full sm:w-[420px] bg-surface-card rounded-3xl border border-border-subtle shadow-2xl animate-in zoom-in-95 duration-300 overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Top bar controls fixed */}
        <div className="absolute top-4 w-full px-4 flex justify-end items-center z-20 pointer-events-none">
          <button 
            onClick={() => {
              setIsEditing(false);
              setErrorMsg('');
              setSuccessMsg('');
              onClose();
            }}
            className="pointer-events-auto p-2 rounded-full bg-surface-base/50 backdrop-blur text-content-base border border-border-subtle hover:bg-surface-card transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable area */}
        <div className="flex-1 overflow-y-auto custom-scrollbar relative">
          
          {/* Header Background */}
          <div className="h-40 bg-gradient-to-br from-surface-card to-surface-base border-b border-border-subtle relative shrink-0">
            <div className="absolute inset-0 opacity-20 geometric-grid-bg" />
          </div>

          {/* Profile Content */}
          <div className="px-6 pb-6 relative">
            {/* Avatar Section */}
            <div className="flex flex-col items-center -mt-16 mb-6 relative z-10">
              <div className="relative group">
                <div className="p-1.5 bg-surface-base rounded-full border-2 border-border-subtle group-hover:border-content-base transition-colors shadow-xl">
                  <img 
                    src={isEditing ? (formData.avatar_url || 'https://via.placeholder.com/150') : (userProfile.avatar_url || userProfile.avatarUrl || 'https://via.placeholder.com/150')} 
                    alt={userProfile.name}
                    className="w-24 h-24 rounded-full object-cover bg-surface-base"
                  />
                </div>
                {isEditing && (
                  <button 
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="absolute bottom-1 right-1 p-2 bg-gold-base text-surface-base rounded-full text-surface-base shadow-lg hover:scale-105 transition-transform"
                  >
                    <Camera className="w-4 h-4" />
                  </button>
                )}
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleImageUpload} 
                  accept="image/*" 
                  className="hidden" 
                />
              </div>
              
              {!isEditing && (
                <div className="mt-4 text-center">
                  <h2 className="text-2xl font-serif text-content-base font-semibold flex items-center justify-center space-x-2">
                    <span>{userProfile.name}</span>
                    {userProfile.loyalty_tier !== 'Bronze' && <ShieldCheck className="w-5 h-5 text-gold-base" />}
                  </h2>
                  <p className="text-content-base text-xs font-bold uppercase tracking-widest mt-1">
                    Membro {userProfile.loyalty_tier || 'Silver'}
                  </p>
                </div>
              )}
            </div>

            {/* Details Section */}
            {!isEditing ? (
              <div className="space-y-4">
                
                {/* Circular Action Buttons */}
                <div className="flex justify-center space-x-6 mb-6">
                  <button
                    onClick={() => {
                      setFormData({
                        name: userProfile.name || '',
                        email: userProfile.email || '',
                        phone: userProfile.phone || '',
                        avatar_url: userProfile.avatar_url || ''
                      });
                      setIsEditing(true);
                      setErrorMsg('');
                    }}
                    className="flex flex-col items-center space-y-2 group"
                  >
                    <div className="w-12 h-12 rounded-full bg-surface-card text-content-base flex items-center justify-center border border-border-subtle shadow-lg group-hover:bg-neutral-700 group-hover:border-gold-base/30 transition-all">
                      <Edit2 className="w-5 h-5 group-hover:text-content-base transition-colors" />
                    </div>
                    <span className="text-[10px] font-bold text-content-muted group-hover:text-content-base transition-colors">Editar</span>
                  </button>
                  <button
                    onClick={() => setShowLogoutConfirm(true)}
                    className="flex flex-col items-center space-y-2 group"
                  >
                    <div className="w-12 h-12 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center border border-red-500/20 shadow-lg group-hover:bg-red-500/20 transition-all">
                      <LogOut className="w-5 h-5" />
                    </div>
                    <span className="text-[10px] font-bold text-content-muted group-hover:text-red-400 transition-colors">Sair</span>
                  </button>
                </div>

                <div className="bg-surface-base border border-border-subtle rounded-2xl p-1 divide-y divide-border-subtle">
                  <div className="flex items-center space-x-3 p-3">
                    <div className="w-8 h-8 rounded-full bg-surface-base flex items-center justify-center border border-border-subtle">
                      <Mail className="w-4 h-4 text-content-base" />
                    </div>
                    <div>
                      <p className="text-[10px] text-content-muted font-bold uppercase">E-mail</p>
                      <p className="text-sm text-content-base font-medium">{userProfile.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3 p-3">
                    <div className="w-8 h-8 rounded-full bg-surface-base flex items-center justify-center border border-border-subtle">
                      <Phone className="w-4 h-4 text-content-base" />
                    </div>
                    <div>
                      <p className="text-[10px] text-content-muted font-bold uppercase">Telefone</p>
                      <p className="text-sm text-content-base font-medium">{userProfile.phone || 'Não informado'}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3 p-3">
                    <div className="w-8 h-8 rounded-full bg-surface-base flex items-center justify-center border border-border-subtle">
                      <Award className="w-4 h-4 text-content-base" />
                    </div>
                    <div className="flex-1 flex justify-between items-center">
                      <div>
                        <p className="text-[10px] text-content-muted font-bold uppercase">Fidelidade</p>
                        <p className="text-sm text-content-base font-medium">{userProfile.loyalty_points || 0} Pontos</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-border-subtle mt-4 space-y-2">
                  <p className="text-[10px] text-content-muted font-bold uppercase mb-2">Privacidade e Dados (LGPD)</p>
                  <button
                    onClick={() => alert('Seus dados foram exportados com sucesso!')}
                    className="w-full py-2.5 rounded-xl bg-surface-card border border-border-subtle text-content-base font-bold text-xs hover:bg-surface-card transition-colors flex items-center justify-center space-x-2 focus:outline-none focus:ring-2 focus:ring-gold-base/50"
                  >
                    <Download className="w-4 h-4" />
                    <span>Exportar meus dados</span>
                  </button>
                  <button
                    onClick={() => setShowDeleteAccountConfirm(true)}
                    className="w-full py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 font-bold text-xs hover:bg-red-500/20 transition-colors flex items-center justify-center space-x-2 focus:outline-none focus:ring-2 focus:ring-red-500/50"
                  >
                    <ShieldCheck className="w-4 h-4" />
                    <span>Excluir minha conta</span>
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSave} className="space-y-4">
                
                {errorMsg && (
                  <div className="bg-red-500/10 border border-red-500/30 p-3 rounded-xl flex items-start space-x-2 text-red-400 text-xs">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{errorMsg}</span>
                  </div>
                )}
                
                {successMsg && (
                  <div className="bg-status-success/10 border border-status-success/30 p-3 rounded-xl flex items-start space-x-2 text-status-success text-xs">
                    <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{successMsg}</span>
                  </div>
                )}

                <div className="space-y-3">
                  <div>
                    <label className="text-[10px] font-bold text-content-muted uppercase block mb-1">Nome Completo</label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full bg-surface-base/50 border border-border-subtle rounded-xl py-3 px-4 text-content-base text-sm focus:border-gold-base focus:ring-1 focus:ring-gold-base focus:outline-none transition-all"
                      placeholder="Seu nome"
                      tabIndex={1}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-content-muted uppercase block mb-1">E-mail</label>
                    <input
                      type="email"
                      required
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full bg-surface-base/50 border border-border-subtle rounded-xl py-3 px-4 text-content-base text-sm focus:border-gold-base focus:ring-1 focus:ring-gold-base focus:outline-none transition-all"
                      placeholder="seu@email.com"
                      tabIndex={2}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-content-muted uppercase block mb-1">Telefone</label>
                    <input
                      type="tel"
                      required
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full bg-surface-base/50 border border-border-subtle rounded-xl py-3 px-4 text-content-base text-sm focus:border-gold-base focus:ring-1 focus:ring-gold-base focus:outline-none transition-all"
                      placeholder="(11) 90000-0000"
                      tabIndex={3}
                    />
                  </div>
                </div>
                
                <div className="flex space-x-3 mt-6 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditing(false);
                      setErrorMsg('');
                      setSuccessMsg('');
                    }}
                    disabled={isSaving}
                    className="flex-1 py-3 rounded-xl bg-surface-card text-content-base font-bold text-sm hover:bg-neutral-700 transition-colors border border-border-subtle focus:outline-none focus:ring-2 focus:ring-white/20 disabled:opacity-50"
                    tabIndex={5}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="flex-1 py-3 rounded-xl bg-gold-base text-surface-base font-extrabold text-sm hover:opacity-95 transition-all flex items-center justify-center space-x-2 shadow-lg shadow-[#C9A96E]/20 focus:outline-none focus:ring-2 focus:ring-gold-base disabled:opacity-50"
                    tabIndex={4}
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Salvando...</span>
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4" />
                        <span>Salvar</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>

      <ConfirmDialog
        isOpen={showLogoutConfirm}
        onClose={() => setShowLogoutConfirm(false)}
        onConfirm={() => {
          setShowLogoutConfirm(false);
          if (onLogout) onLogout();
          onClose();
        }}
        variant="danger"
        icon={<AlertTriangle className="w-6 h-6" />}
        title="Deseja sair da conta?"
        description="Ao sair da conta, você precisará fazer login novamente para acessar seus benefícios do clube VIP e histórico sincronizado."
        confirmText="Sim, Sair"
        cancelText="Permanecer Conectado"
      />

      <ConfirmDialog
        isOpen={showDeleteAccountConfirm}
        onClose={() => setShowDeleteAccountConfirm(false)}
        onConfirm={async () => {
          setIsDeletingAccount(true);
          try {
            await authFetch(`/api/profiles/${userProfile.id}`, { method: 'DELETE' });
            alert('Sua conta e dados foram excluídos com sucesso.');
            setShowDeleteAccountConfirm(false);
            if (onLogout) onLogout();
            onClose();
          } catch (err) {
            console.warn(err);
            alert('Erro ao excluir conta.');
          } finally {
            setIsDeletingAccount(false);
          }
        }}
        isLoading={isDeletingAccount}
        variant="danger"
        icon={<AlertTriangle className="w-6 h-6" />}
        title="Excluir conta permanentemente?"
        description="Esta ação apaga todos os seus dados, pontos de fidelidade e agendamentos salvos. Ela não pode ser desfeita."
        confirmText="Excluir Conta"
        cancelText="Cancelar"
      />
    </div>
  );
};
