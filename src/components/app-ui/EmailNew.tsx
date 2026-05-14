import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { ArrowLeft, Save, Send, Mail, Users, Eye, Image, Link as LinkIcon, Type, Bold, Italic, List, AlignLeft } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Textarea } from '../ui/textarea';
import { Switch } from '../ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { toast } from 'sonner';

export function EmailNew() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    campaignName: '',
    subject: '',
    preheader: '',
    fromName: '',
    fromEmail: '',
    replyTo: '',
    audience: '',
    segmentFilter: '',
    emailContent: '',
    scheduledDate: '',
    scheduledTime: '',
    trackOpens: true,
    trackClicks: true,
    sendTest: false,
    testEmail: ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    toast.success('Campanha de email criada com sucesso!');
    setTimeout(() => navigate('/app-ui/email'), 1500);
  };

  const handleChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSendTest = () => {
    if (!formData.testEmail) {
      toast.error('Digite um email para enviar o teste');
      return;
    }
    toast.success(`Email de teste enviado para ${formData.testEmail}`);
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
            <Mail className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Nova Campanha de Email</h1>
            <p className="text-slate-600 dark:text-slate-400">Criar e enviar campanha de email para membros</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Formulário Principal */}
          <div className="lg:col-span-2 space-y-6">
            {/* Informações da Campanha */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mail className="w-5 h-5" />
                  Informações da Campanha
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="campaignName">Nome da Campanha *</Label>
                  <Input
                    id="campaignName"
                    required
                    value={formData.campaignName}
                    onChange={(e) => handleChange('campaignName', e.target.value)}
                    placeholder="Ex: Convite Culto Especial - Março 2026"
                  />
                  <p className="text-sm text-slate-500 mt-1">Apenas para controle interno</p>
                </div>

                <div>
                  <Label htmlFor="subject">Assunto do Email *</Label>
                  <Input
                    id="subject"
                    required
                    value={formData.subject}
                    onChange={(e) => handleChange('subject', e.target.value)}
                    placeholder="Ex: Você está convidado para nosso culto especial!"
                  />
                </div>

                <div>
                  <Label htmlFor="preheader">Pré-header</Label>
                  <Input
                    id="preheader"
                    value={formData.preheader}
                    onChange={(e) => handleChange('preheader', e.target.value)}
                    placeholder="Texto de visualização que aparece após o assunto"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Remetente */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mail className="w-5 h-5" />
                  Informações do Remetente
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="fromName">Nome do Remetente *</Label>
                    <Input
                      id="fromName"
                      required
                      value={formData.fromName}
                      onChange={(e) => handleChange('fromName', e.target.value)}
                      placeholder="Ex: Igreja Batista Central"
                    />
                  </div>
                  <div>
                    <Label htmlFor="fromEmail">Email do Remetente *</Label>
                    <Input
                      id="fromEmail"
                      type="email"
                      required
                      value={formData.fromEmail}
                      onChange={(e) => handleChange('fromEmail', e.target.value)}
                      placeholder="contato@igreja.com"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="replyTo">Email de Resposta</Label>
                  <Input
                    id="replyTo"
                    type="email"
                    value={formData.replyTo}
                    onChange={(e) => handleChange('replyTo', e.target.value)}
                    placeholder="resposta@igreja.com"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Destinatários */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  Destinatários
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="audience">Público-alvo *</Label>
                  <Select value={formData.audience} onValueChange={(value) => handleChange('audience', value)}>
                    <SelectTrigger id="audience">
                      <SelectValue placeholder="Selecione o público" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all-members">Todos os Membros</SelectItem>
                      <SelectItem value="active-members">Membros Ativos</SelectItem>
                      <SelectItem value="visitors">Visitantes</SelectItem>
                      <SelectItem value="youth">Jovens</SelectItem>
                      <SelectItem value="children-parents">Pais de Crianças</SelectItem>
                      <SelectItem value="ministry">Por Ministério</SelectItem>
                      <SelectItem value="cell-group">Por Célula</SelectItem>
                      <SelectItem value="custom">Lista Personalizada</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {formData.audience && (
                  <div className="p-4 bg-blue-50 rounded-lg">
                    <p className="text-sm font-medium text-blue-900">Destinatários estimados</p>
                    <p className="text-2xl font-bold text-blue-600">342 pessoas</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Conteúdo do Email */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Type className="w-5 h-5" />
                  Conteúdo do Email
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="editor">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="editor">Editor</TabsTrigger>
                    <TabsTrigger value="html">HTML</TabsTrigger>
                  </TabsList>
                  <TabsContent value="editor" className="space-y-3">
                    {/* Toolbar */}
                    <div className="flex flex-wrap gap-1 p-2 border rounded-lg bg-slate-50">
                      <Button type="button" variant="ghost" size="sm">
                        <Bold className="w-4 h-4" />
                      </Button>
                      <Button type="button" variant="ghost" size="sm">
                        <Italic className="w-4 h-4" />
                      </Button>
                      <Button type="button" variant="ghost" size="sm">
                        <List className="w-4 h-4" />
                      </Button>
                      <Button type="button" variant="ghost" size="sm">
                        <AlignLeft className="w-4 h-4" />
                      </Button>
                      <Button type="button" variant="ghost" size="sm">
                        <LinkIcon className="w-4 h-4" />
                      </Button>
                      <Button type="button" variant="ghost" size="sm">
                        <Image className="w-4 h-4" />
                      </Button>
                    </div>
                    <Textarea
                      id="emailContent"
                      rows={12}
                      value={formData.emailContent}
                      onChange={(e) => handleChange('emailContent', e.target.value)}
                      placeholder="Digite o conteúdo do seu email aqui..."
                      className="font-sans"
                    />
                  </TabsContent>
                  <TabsContent value="html">
                    <Textarea
                      rows={12}
                      value={formData.emailContent}
                      onChange={(e) => handleChange('emailContent', e.target.value)}
                      placeholder="<html>...</html>"
                      className="font-mono text-sm"
                    />
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Agendamento */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Agendamento</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="scheduledDate">Data de Envio</Label>
                  <Input
                    id="scheduledDate"
                    type="date"
                    value={formData.scheduledDate}
                    onChange={(e) => handleChange('scheduledDate', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="scheduledTime">Horário</Label>
                  <Input
                    id="scheduledTime"
                    type="time"
                    value={formData.scheduledTime}
                    onChange={(e) => handleChange('scheduledTime', e.target.value)}
                  />
                </div>
                <p className="text-sm text-slate-500">
                  Deixe em branco para enviar imediatamente
                </p>
              </CardContent>
            </Card>

            {/* Rastreamento */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Rastreamento</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label htmlFor="trackOpens">Rastrear Aberturas</Label>
                  <Switch
                    id="trackOpens"
                    checked={formData.trackOpens}
                    onCheckedChange={(checked) => handleChange('trackOpens', checked)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="trackClicks">Rastrear Cliques</Label>
                  <Switch
                    id="trackClicks"
                    checked={formData.trackClicks}
                    onCheckedChange={(checked) => handleChange('trackClicks', checked)}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Email de Teste */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Enviar Teste</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Label htmlFor="testEmail">Email para Teste</Label>
                  <Input
                    id="testEmail"
                    type="email"
                    value={formData.testEmail}
                    onChange={(e) => handleChange('testEmail', e.target.value)}
                    placeholder="seu@email.com"
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={handleSendTest}
                >
                  <Eye className="w-4 h-4 mr-2" />
                  Enviar Teste
                </Button>
              </CardContent>
            </Card>

            {/* Botões de Ação */}
            <div className="space-y-3">
              <Button type="submit" className="w-full bg-purple-600 hover:bg-purple-700">
                <Save className="w-4 h-4 mr-2" />
                Salvar Rascunho
              </Button>
              <Button
                type="button"
                className="w-full bg-green-600 hover:bg-green-700"
                onClick={(e) => {
                  handleSubmit(e as any);
                }}
              >
                <Send className="w-4 h-4 mr-2" />
                {formData.scheduledDate ? 'Agendar Envio' : 'Enviar Agora'}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => navigate('/app-ui/email')}
              >
                Cancelar
              </Button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
