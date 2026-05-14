import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { ArrowLeft, Save, FileText, User, Calendar, Upload } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Textarea } from '../ui/textarea';
import { toast } from 'sonner';

export function RequirementsNew() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    type: '',
    requesterName: '',
    requesterPhone: '',
    requesterEmail: '',
    memberNumber: '',
    eventDate: '',
    eventTime: '',
    eventLocation: '',
    numberOfGuests: '',
    observations: '',
    documents: [] as File[]
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    toast.success('Requerimento enviado com sucesso!');
    setTimeout(() => navigate('/app-ui/dashboard'), 1500);
  };

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setFormData(prev => ({ ...prev, documents: files }));
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center">
            <FileText className="w-6 h-6 text-slate-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Novo Requerimento</h1>
            <p className="text-slate-600 dark:text-slate-400">Solicitar serviços e documentos da igreja</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Tipo de Requerimento */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Tipo de Requerimento
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div>
              <Label htmlFor="type">Selecione o tipo de requerimento *</Label>
              <Select value={formData.type} onValueChange={(value) => handleChange('type', value)}>
                <SelectTrigger id="type">
                  <SelectValue placeholder="Escolha o tipo de requerimento" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="casamento">Casamento</SelectItem>
                  <SelectItem value="batismo">Batismo</SelectItem>
                  <SelectItem value="apresentacao">Apresentação de Criança</SelectItem>
                  <SelectItem value="carta-transferencia">Carta de Transferência</SelectItem>
                  <SelectItem value="carta-recomendacao">Carta de Recomendação</SelectItem>
                  <SelectItem value="declaracao-membro">Declaração de Membro</SelectItem>
                  <SelectItem value="consagracao">Consagração</SelectItem>
                  <SelectItem value="credencial">Credencial Ministerial</SelectItem>
                  <SelectItem value="uso-espaco">Uso de Espaço</SelectItem>
                  <SelectItem value="outro">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Descrição do tipo selecionado */}
            {formData.type && (
              <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                <p className="text-sm text-blue-900">
                  {formData.type === 'casamento' && 'Solicitação para realização de cerimônia de casamento na igreja.'}
                  {formData.type === 'batismo' && 'Solicitação para participar da próxima cerimônia de batismo.'}
                  {formData.type === 'apresentacao' && 'Solicitação para apresentação de criança ao Senhor.'}
                  {formData.type === 'carta-transferencia' && 'Solicitação de carta de transferência para outra igreja.'}
                  {formData.type === 'carta-recomendacao' && 'Solicitação de carta de recomendação.'}
                  {formData.type === 'declaracao-membro' && 'Solicitação de declaração de que é membro da igreja.'}
                  {formData.type === 'consagracao' && 'Solicitação para consagração ministerial.'}
                  {formData.type === 'credencial' && 'Solicitação de credencial ministerial.'}
                  {formData.type === 'uso-espaco' && 'Solicitação para uso de espaço da igreja para evento.'}
                  {formData.type === 'outro' && 'Outro tipo de requerimento.'}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Dados do Solicitante */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="w-5 h-5" />
              Dados do Solicitante
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="requesterName">Nome Completo *</Label>
                <Input
                  id="requesterName"
                  required
                  value={formData.requesterName}
                  onChange={(e) => handleChange('requesterName', e.target.value)}
                  placeholder="Digite seu nome completo"
                />
              </div>
              <div>
                <Label htmlFor="memberNumber">Número de Membro</Label>
                <Input
                  id="memberNumber"
                  value={formData.memberNumber}
                  onChange={(e) => handleChange('memberNumber', e.target.value)}
                  placeholder="Ex: 001"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="requesterPhone">Telefone *</Label>
                <Input
                  id="requesterPhone"
                  required
                  value={formData.requesterPhone}
                  onChange={(e) => handleChange('requesterPhone', e.target.value)}
                  placeholder="(00) 00000-0000"
                />
              </div>
              <div>
                <Label htmlFor="requesterEmail">Email *</Label>
                <Input
                  id="requesterEmail"
                  type="email"
                  required
                  value={formData.requesterEmail}
                  onChange={(e) => handleChange('requesterEmail', e.target.value)}
                  placeholder="email@exemplo.com"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Detalhes do Evento (para casamento, batismo, etc) */}
        {(formData.type === 'casamento' || formData.type === 'batismo' || formData.type === 'apresentacao' || formData.type === 'uso-espaco') && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                Detalhes do Evento
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="eventDate">Data Desejada</Label>
                  <Input
                    id="eventDate"
                    type="date"
                    value={formData.eventDate}
                    onChange={(e) => handleChange('eventDate', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="eventTime">Horário Desejado</Label>
                  <Input
                    id="eventTime"
                    type="time"
                    value={formData.eventTime}
                    onChange={(e) => handleChange('eventTime', e.target.value)}
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="eventLocation">Local</Label>
                <Select value={formData.eventLocation} onValueChange={(value) => handleChange('eventLocation', value)}>
                  <SelectTrigger id="eventLocation">
                    <SelectValue placeholder="Selecione o local" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="templo-central">Templo Central</SelectItem>
                    <SelectItem value="templo-filial">Templo Filial</SelectItem>
                    <SelectItem value="salao-eventos">Salão de Eventos</SelectItem>
                    <SelectItem value="auditorio">Auditório</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {formData.type === 'uso-espaco' && (
                <div>
                  <Label htmlFor="numberOfGuests">Número Estimado de Convidados</Label>
                  <Input
                    id="numberOfGuests"
                    type="number"
                    value={formData.numberOfGuests}
                    onChange={(e) => handleChange('numberOfGuests', e.target.value)}
                    placeholder="Ex: 50"
                  />
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Observações */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Informações Adicionais
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="observations">Observações</Label>
              <Textarea
                id="observations"
                rows={5}
                value={formData.observations}
                onChange={(e) => handleChange('observations', e.target.value)}
                placeholder="Adicione informações adicionais sobre seu requerimento"
              />
            </div>
            <div>
              <Label htmlFor="documents">Anexar Documentos</Label>
              <div className="mt-2">
                <label htmlFor="file-upload" className="cursor-pointer">
                  <div className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center hover:border-purple-400 transition-colors">
                    <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      Clique para fazer upload de documentos
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      PDF, JPG, PNG até 5MB
                    </p>
                  </div>
                  <Input
                    id="file-upload"
                    type="file"
                    multiple
                    accept=".pdf,.jpg,.jpeg,.png"
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                </label>
                {formData.documents.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {formData.documents.map((file, index) => (
                      <div key={index} className="flex items-center gap-2 text-sm text-slate-600">
                        <FileText className="w-4 h-4" />
                        <span>{file.name}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Informações Importantes */}
        <Card className="bg-amber-50 border-amber-200">
          <CardContent className="p-6">
            <h3 className="font-semibold text-amber-900 mb-2">Informações Importantes</h3>
            <ul className="text-sm text-amber-800 space-y-1">
              <li>• O requerimento será analisado pela secretaria da igreja</li>
              <li>• Você receberá uma resposta em até 3 dias úteis</li>
              <li>• Alguns requerimentos podem exigir documentação adicional</li>
              <li>• Para casamento, é necessário passar pelo curso de noivos</li>
              <li>• Para batismo, é necessário passar pela classe de batismo</li>
            </ul>
          </CardContent>
        </Card>

        {/* Botões de Ação */}
        <div className="flex gap-3 justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate('/app-ui/dashboard')}
          >
            Cancelar
          </Button>
          <Button type="submit" className="bg-purple-600 hover:bg-purple-700">
            <Save className="w-4 h-4 mr-2" />
            Enviar Requerimento
          </Button>
        </div>
      </form>
    </div>
  );
}
