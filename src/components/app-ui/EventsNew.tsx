import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { ArrowLeft, Save, Calendar, MapPin, Users, DollarSign, Clock, Image, FileText, Tag, Bell } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Textarea } from '../ui/textarea';
import { Switch } from '../ui/switch';
import { toast } from 'sonner';

export function EventsNew() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: '',
    type: '',
    category: '',
    description: '',
    startDate: '',
    endDate: '',
    startTime: '',
    endTime: '',
    location: '',
    address: '',
    city: '',
    state: '',
    maxCapacity: '',
    requiresRegistration: false,
    requiresTicket: false,
    ticketPrice: '',
    enableWaitlist: false,
    visibility: 'public',
    organizer: '',
    contactEmail: '',
    contactPhone: '',
    tags: '',
    imageUrl: '',
    enableNotifications: true,
    allowGuests: true,
    ageRestriction: ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    toast.success('Evento criado com sucesso!');
    setTimeout(() => navigate('/app-ui/events'), 1500);
  };

  const handleChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
            <Calendar className="w-6 h-6 text-orange-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Novo Evento</h1>
            <p className="text-slate-600 dark:text-slate-400">Criar novo evento na igreja</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Informações Básicas */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Informações Básicas
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="name">Nome do Evento *</Label>
              <Input
                id="name"
                required
                value={formData.name}
                onChange={(e) => handleChange('name', e.target.value)}
                placeholder="Ex: Culto de Celebração, Conferência Anual"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="type">Tipo de Evento *</Label>
                <Select value={formData.type} onValueChange={(value) => handleChange('type', value)}>
                  <SelectTrigger id="type">
                    <SelectValue placeholder="Selecione o tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="culto">Culto</SelectItem>
                    <SelectItem value="conferencia">Conferência</SelectItem>
                    <SelectItem value="retiro">Retiro</SelectItem>
                    <SelectItem value="casamento">Casamento</SelectItem>
                    <SelectItem value="batismo">Batismo</SelectItem>
                    <SelectItem value="santa-ceia">Santa Ceia</SelectItem>
                    <SelectItem value="aniversario">Aniversário da Igreja</SelectItem>
                    <SelectItem value="evangelismo">Evangelismo</SelectItem>
                    <SelectItem value="jovens">Encontro de Jovens</SelectItem>
                    <SelectItem value="criancas">Evento Infantil</SelectItem>
                    <SelectItem value="outro">Outro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="category">Categoria</Label>
                <Select value={formData.category} onValueChange={(value) => handleChange('category', value)}>
                  <SelectTrigger id="category">
                    <SelectValue placeholder="Selecione a categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="espiritual">Espiritual</SelectItem>
                    <SelectItem value="social">Social</SelectItem>
                    <SelectItem value="ministerial">Ministerial</SelectItem>
                    <SelectItem value="educacional">Educacional</SelectItem>
                    <SelectItem value="comunitario">Comunitário</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label htmlFor="description">Descrição</Label>
              <Textarea
                id="description"
                rows={4}
                value={formData.description}
                onChange={(e) => handleChange('description', e.target.value)}
                placeholder="Descreva o evento, programação, objetivos, etc."
              />
            </div>
          </CardContent>
        </Card>

        {/* Data e Horário */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Data e Horário
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="startDate">Data de Início *</Label>
              <Input
                id="startDate"
                type="date"
                required
                value={formData.startDate}
                onChange={(e) => handleChange('startDate', e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="endDate">Data de Término</Label>
              <Input
                id="endDate"
                type="date"
                value={formData.endDate}
                onChange={(e) => handleChange('endDate', e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="startTime">Horário de Início *</Label>
              <Input
                id="startTime"
                type="time"
                required
                value={formData.startTime}
                onChange={(e) => handleChange('startTime', e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="endTime">Horário de Término</Label>
              <Input
                id="endTime"
                type="time"
                value={formData.endTime}
                onChange={(e) => handleChange('endTime', e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Local */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="w-5 h-5" />
              Local do Evento
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="location">Nome do Local *</Label>
              <Input
                id="location"
                required
                value={formData.location}
                onChange={(e) => handleChange('location', e.target.value)}
                placeholder="Ex: Templo Central, Salão de Eventos"
              />
            </div>
            <div>
              <Label htmlFor="address">Endereço</Label>
              <Input
                id="address"
                value={formData.address}
                onChange={(e) => handleChange('address', e.target.value)}
                placeholder="Rua, número, complemento"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="city">Cidade</Label>
                <Input
                  id="city"
                  value={formData.city}
                  onChange={(e) => handleChange('city', e.target.value)}
                  placeholder="Cidade"
                />
              </div>
              <div>
                <Label htmlFor="state">Estado</Label>
                <Input
                  id="state"
                  value={formData.state}
                  onChange={(e) => handleChange('state', e.target.value)}
                  placeholder="UF"
                  maxLength={2}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Configurações */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Configurações do Evento
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="maxCapacity">Capacidade Máxima</Label>
                <Input
                  id="maxCapacity"
                  type="number"
                  value={formData.maxCapacity}
                  onChange={(e) => handleChange('maxCapacity', e.target.value)}
                  placeholder="Número de vagas"
                />
              </div>
              <div>
                <Label htmlFor="visibility">Visibilidade</Label>
                <Select value={formData.visibility} onValueChange={(value) => handleChange('visibility', value)}>
                  <SelectTrigger id="visibility">
                    <SelectValue placeholder="Selecione a visibilidade" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="public">Público</SelectItem>
                    <SelectItem value="members">Apenas Membros</SelectItem>
                    <SelectItem value="private">Privado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="requiresRegistration">Requer Inscrição</Label>
                  <p className="text-sm text-slate-500">Os participantes precisam se inscrever</p>
                </div>
                <Switch
                  id="requiresRegistration"
                  checked={formData.requiresRegistration}
                  onCheckedChange={(checked) => handleChange('requiresRegistration', checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="requiresTicket">Requer Ingresso</Label>
                  <p className="text-sm text-slate-500">Evento com venda de ingressos</p>
                </div>
                <Switch
                  id="requiresTicket"
                  checked={formData.requiresTicket}
                  onCheckedChange={(checked) => handleChange('requiresTicket', checked)}
                />
              </div>

              {formData.requiresTicket && (
                <div>
                  <Label htmlFor="ticketPrice">Preço do Ingresso</Label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                    <Input
                      id="ticketPrice"
                      type="number"
                      step="0.01"
                      className="pl-10"
                      value={formData.ticketPrice}
                      onChange={(e) => handleChange('ticketPrice', e.target.value)}
                      placeholder="0.00"
                    />
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="enableWaitlist">Lista de Espera</Label>
                  <p className="text-sm text-slate-500">Permitir lista de espera quando lotado</p>
                </div>
                <Switch
                  id="enableWaitlist"
                  checked={formData.enableWaitlist}
                  onCheckedChange={(checked) => handleChange('enableWaitlist', checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="allowGuests">Permitir Convidados</Label>
                  <p className="text-sm text-slate-500">Participantes podem trazer convidados</p>
                </div>
                <Switch
                  id="allowGuests"
                  checked={formData.allowGuests}
                  onCheckedChange={(checked) => handleChange('allowGuests', checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="enableNotifications">Enviar Notificações</Label>
                  <p className="text-sm text-slate-500">Notificar participantes sobre o evento</p>
                </div>
                <Switch
                  id="enableNotifications"
                  checked={formData.enableNotifications}
                  onCheckedChange={(checked) => handleChange('enableNotifications', checked)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Organizador e Contato */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Organizador e Contato
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="organizer">Organizador</Label>
              <Select value={formData.organizer} onValueChange={(value) => handleChange('organizer', value)}>
                <SelectTrigger id="organizer">
                  <SelectValue placeholder="Selecione o organizador" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pastor-joao">Pastor João Silva</SelectItem>
                  <SelectItem value="pastor-ana">Pastora Ana Costa</SelectItem>
                  <SelectItem value="ministerio-jovens">Ministério de Jovens</SelectItem>
                  <SelectItem value="ministerio-criancas">Ministério Infantil</SelectItem>
                  <SelectItem value="ministerio-louvor">Ministério de Louvor</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="ageRestriction">Restrição de Idade</Label>
              <Input
                id="ageRestriction"
                value={formData.ageRestriction}
                onChange={(e) => handleChange('ageRestriction', e.target.value)}
                placeholder="Ex: 18+, Livre, 12+"
              />
            </div>
            <div>
              <Label htmlFor="contactEmail">Email de Contato</Label>
              <Input
                id="contactEmail"
                type="email"
                value={formData.contactEmail}
                onChange={(e) => handleChange('contactEmail', e.target.value)}
                placeholder="contato@igreja.com"
              />
            </div>
            <div>
              <Label htmlFor="contactPhone">Telefone de Contato</Label>
              <Input
                id="contactPhone"
                value={formData.contactPhone}
                onChange={(e) => handleChange('contactPhone', e.target.value)}
                placeholder="(00) 00000-0000"
              />
            </div>
          </CardContent>
        </Card>

        {/* Mídia e Tags */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Image className="w-5 h-5" />
              Mídia e Tags
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="imageUrl">URL da Imagem do Evento</Label>
              <Input
                id="imageUrl"
                type="url"
                value={formData.imageUrl}
                onChange={(e) => handleChange('imageUrl', e.target.value)}
                placeholder="https://exemplo.com/imagem.jpg"
              />
            </div>
            <div>
              <Label htmlFor="tags">Tags</Label>
              <div className="relative">
                <Tag className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                <Input
                  id="tags"
                  className="pl-10"
                  value={formData.tags}
                  onChange={(e) => handleChange('tags', e.target.value)}
                  placeholder="Ex: louvor, adoração, jovens"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Botões de Ação */}
        <div className="flex gap-3 justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate('/app-ui/events')}
          >
            Cancelar
          </Button>
          <Button type="submit" className="bg-purple-600 hover:bg-purple-700">
            <Save className="w-4 h-4 mr-2" />
            Criar Evento
          </Button>
        </div>
      </form>
    </div>
  );
}
