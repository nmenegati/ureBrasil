import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Label } from '@/components/ui/label';
import { Search, Mail, AlertCircle, CheckCircle2, Loader2, ArrowLeft } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { formatCPF, validateEmail } from '@/lib/validators';

interface StudentProfile {
  id: string;
  user_id: string;
  full_name: string;
  cpf: string;
  email: string;
  phone: string;
  email_confirmed_at: string | null;
}

export default function AdminEditEmail() {
  const navigate = useNavigate();
  const [cpfSearch, setCpfSearch] = useState('');
  const [searching, setSearching] = useState(false);
  const [student, setStudent] = useState<StudentProfile | null>(null);
  const [newEmail, setNewEmail] = useState('');
  const [updating, setUpdating] = useState(false);

  const handleSearch = async () => {
    const cleanCpf = cpfSearch.replace(/\D/g, '');
    
    if (cleanCpf.length !== 11) {
      toast({
        variant: 'destructive',
        title: 'CPF inválido',
        description: 'Digite um CPF válido com 11 dígitos.',
      });
      return;
    }

    setSearching(true);
    setStudent(null);
    setNewEmail('');

    try {
      // Buscar perfil do aluno por CPF
      const { data: profileData, error: profileError } = await supabase
        .from('student_profiles')
        .select('id, user_id, full_name, cpf, phone')
        .eq('cpf', cleanCpf)
        .single();

      if (profileError || !profileData) {
        toast({
          variant: 'destructive',
          title: 'Aluno não encontrado',
          description: 'Nenhum cadastro encontrado com este CPF.',
        });
        return;
      }

      // Buscar email do auth.users (usando função RPC para evitar problemas de RLS)
      const { data: { user }, error: userError } = await supabase.auth.admin.getUserById(
        profileData.user_id
      );

      if (userError || !user) {
        toast({
          variant: 'destructive',
          title: 'Erro ao buscar dados',
          description: 'Não foi possível carregar o email do usuário.',
        });
        return;
      }

      setStudent({
        ...profileData,
        email: user.email || '',
        email_confirmed_at: user.email_confirmed_at || null,
      });
      setNewEmail(user.email || '');

    } catch (err: any) {
      console.error('Error searching student:', err);
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: err.message,
      });
    } finally {
      setSearching(false);
    }
  };

  const handleUpdateEmail = async () => {
    if (!student || !newEmail) return;

    if (!validateEmail(newEmail)) {
      toast({
        variant: 'destructive',
        title: 'Email inválido',
        description: 'Digite um email válido.',
      });
      return;
    }

    if (newEmail === student.email) {
      toast({
        variant: 'destructive',
        title: 'Mesmo email',
        description: 'O novo email é igual ao atual.',
      });
      return;
    }

    setUpdating(true);

    try {
      const { data, error } = await supabase.functions.invoke('admin-update-email', {
        body: {
          targetUserId: student.user_id,
          newEmail: newEmail.trim(),
        },
      });

      if (error) {
        throw error;
      }

      toast({
        title: 'Email atualizado!',
        description: 'Um email de confirmação foi enviado para o novo endereço.',
      });

      // Atualizar os dados do aluno na tela
      setStudent({
        ...student,
        email: newEmail,
        email_confirmed_at: null, // Email foi resetado
      });

    } catch (err: any) {
      console.error('Error updating email:', err);
      toast({
        variant: 'destructive',
        title: 'Erro ao atualizar email',
        description: err.message || 'Não foi possível atualizar o email.',
      });
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Editar Email de Aluno</h1>
            <p className="text-muted-foreground">Busque por CPF e atualize o email</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Buscar Aluno por CPF</CardTitle>
            <CardDescription>
              Digite o CPF do aluno para localizar o cadastro
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <div className="flex-1">
                <Input
                  placeholder="000.000.000-00"
                  value={cpfSearch}
                  onChange={(e) => setCpfSearch(formatCPF(e.target.value))}
                  maxLength={14}
                  disabled={searching}
                />
              </div>
              <Button onClick={handleSearch} disabled={searching}>
                {searching ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Search className="w-4 h-4" />
                )}
                Buscar
              </Button>
            </div>
          </CardContent>
        </Card>

        {student && (
          <Card>
            <CardHeader>
              <CardTitle>Dados do Aluno</CardTitle>
              <CardDescription>
                Informações do cadastro encontrado
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4">
                <div>
                  <Label className="text-muted-foreground">Nome Completo</Label>
                  <p className="font-medium">{student.full_name}</p>
                </div>
                
                <div>
                  <Label className="text-muted-foreground">CPF</Label>
                  <p className="font-medium">{formatCPF(student.cpf)}</p>
                </div>
                
                <div>
                  <Label className="text-muted-foreground">Telefone</Label>
                  <p className="font-medium">{student.phone}</p>
                </div>

                <div>
                  <Label className="text-muted-foreground">Email Atual</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <p className="font-medium break-all">{student.email}</p>
                    {student.email_confirmed_at ? (
                      <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-yellow-500 flex-shrink-0" />
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {student.email_confirmed_at 
                      ? 'Email confirmado' 
                      : 'Email não confirmado'}
                  </p>
                </div>
              </div>

              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Importante:</strong> Ao alterar o email, o aluno precisará confirmar o novo endereço. 
                  Entre em contato com o aluno por telefone para informar sobre a mudança.
                </AlertDescription>
              </Alert>

              <div className="space-y-4 pt-4 border-t">
                <div>
                  <Label htmlFor="newEmail">Novo Email</Label>
                  <div className="flex gap-2 mt-2">
                    <Input
                      id="newEmail"
                      type="email"
                      placeholder="novo-email@exemplo.com"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      disabled={updating}
                    />
                    <Button 
                      onClick={handleUpdateEmail} 
                      disabled={updating || newEmail === student.email}
                    >
                      {updating ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Atualizando...
                        </>
                      ) : (
                        <>
                          <Mail className="w-4 h-4 mr-2" />
                          Atualizar
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
