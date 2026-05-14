import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { ArrowLeft, Save, Search, User, Users, Calendar, Clock, MapPin, Tag, CheckCircle2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Badge } from '../ui/badge';
import { toast } from 'sonner';

interface Member {
  id: string;
  name: string;
  photo?: string;
  membershipNumber: string;
  ministry?: string;
}

export function CheckInManual() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [formData, setFormData] = useState({
    service: '',
    location: '',
    notes: '',
    asVisitor: false
  });

  // Mock members data
  const members: Member[] = [
    { id: '1', name: 'João Silva Santos', membershipNumber: '001', ministry: 'Louvor' },
    { id: '2', name: 'Maria Oliveira Costa', membershipNumber: '002', ministry: 'Intercessão' },
    { id: '3', name: 'Carlos Pereira Lima', membershipNumber: '003', ministry: 'Mídia' },
    { id: '4', name: 'Ana Paula Souza', membershipNumber: '004', ministry: 'Infantil' },
    { id: '5', name: 'Pedro Henrique Alves', membershipNumber: '005', ministry: 'Jovens' },
  ];

  const filteredMembers = members.filter(member =>
    member.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    member.membershipNumber.includes(searchTerm)
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMember) {
      toast.error('Selecione um membro para fazer check-in');
      return;
    }
    toast.success(`Check-in realizado com sucesso para ${selectedMember.name}!`);
    setTimeout(() => navigate('/app-ui/checkin'), 1500);
  };

  const handleChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSelectMember = (member: Member) => {
    setSelectedMember(member);
    setSearchTerm('');
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Check-in Manual</h1>
        <p className="text-slate-600 dark:text-slate-400">Realizar check-in manual de participantes</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Buscar Membro */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="w-5 h-5" />
              Buscar Participante
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="search">Nome ou Número de Membro</Label>
              <div className="relative">
                <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                <Input
                  id="search"
                  className="pl-10"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Digite o nome ou número de membro"
                />
              </div>
            </div>

            {/* Search Results */}
            {searchTerm && (
              <div className="border rounded-lg overflow-hidden">
                {filteredMembers.length > 0 ? (
                  <div className="divide-y">
                    {filteredMembers.map((member) => (
                      <div
                        key={member.id}
                        className="p-3 hover:bg-slate-50 cursor-pointer transition-colors"
                        onClick={() => handleSelectMember(member)}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                            <User className="w-5 h-5 text-purple-600" />
                          </div>
                          <div className="flex-1">
                            <p className="font-medium text-slate-900">{member.name}</p>
                            <p className="text-sm text-slate-500">Membro #{member.membershipNumber}</p>
                          </div>
                          {member.ministry && (
                            <Badge variant="secondary">{member.ministry}</Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-8 text-center text-slate-500">
                    <Users className="w-12 h-12 mx-auto mb-2 text-slate-300" />
                    <p>Nenhum membro encontrado</p>
                  </div>
                )}
              </div>
            )}

            {/* Selected Member */}
            {selectedMember && (
              <div className="border-2 border-purple-200 bg-purple-50 rounded-lg p-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-purple-600 rounded-full flex items-center justify-center">
                    <User className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <p className="font-bold text-slate-900">{selectedMember.name}</p>
                    <p className="text-sm text-slate-600 dark:text-slate-400">Membro #{selectedMember.membershipNumber}</p>
                  </div>
                  <CheckCircle2 className="w-6 h-6 text-green-600" />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Informações do Check-in */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Detalhes do Check-in
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="service">Culto/Evento *</Label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                  <Select value={formData.service} onValueChange={(value) => handleChange('service', value)}>
                    <SelectTrigger id="service" className="pl-10">
                      <SelectValue placeholder="Selecione o culto" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="domingo-manha">Culto de Domingo - Manhã (09:00)</SelectItem>
                      <SelectItem value="domingo-noite">Culto de Domingo - Noite (19:00)</SelectItem>
                      <SelectItem value="quarta-oracao">Culto de Oração - Quarta (19:30)</SelectItem>
                      <SelectItem value="sexta-jovens">Culto de Jovens - Sexta (20:00)</SelectItem>
                      <SelectItem value="celula">Reunião de Célula</SelectItem>
                      <SelectItem value="evento-especial">Evento Especial</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor="location">Local *</Label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                  <Select value={formData.location} onValueChange={(value) => handleChange('location', value)}>
                    <SelectTrigger id="location" className="pl-10">
                      <SelectValue placeholder="Selecione o local" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="templo-central">Templo Central</SelectItem>
                      <SelectItem value="templo-filial">Templo Filial</SelectItem>
                      <SelectItem value="salao-eventos">Salão de Eventos</SelectItem>
                      <SelectItem value="auditorio">Auditório</SelectItem>
                      <SelectItem value="outro">Outro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
              <div className="flex items-center gap-3">
                <Clock className="w-5 h-5 text-slate-500" />
                <div>
                  <p className="text-sm font-medium text-slate-900">Horário do Check-in</p>
                  <p className="text-sm text-slate-600 dark:text-slate-400">{new Date().toLocaleString('pt-BR')}</p>
                </div>
              </div>
            </div>

            <div>
              <Label htmlFor="notes">Observações</Label>
              <Input
                id="notes"
                value={formData.notes}
                onChange={(e) => handleChange('notes', e.target.value)}
                placeholder="Adicione observações se necessário"
              />
            </div>
          </CardContent>
        </Card>

        {/* Estatísticas do Dia */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Check-ins de Hoje
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <p className="text-2xl font-bold text-blue-600">127</p>
                <p className="text-sm text-slate-600 dark:text-slate-400">Total</p>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <p className="text-2xl font-bold text-green-600">98</p>
                <p className="text-sm text-slate-600 dark:text-slate-400">Membros</p>
              </div>
              <div className="text-center p-4 bg-purple-50 rounded-lg">
                <p className="text-2xl font-bold text-purple-600">29</p>
                <p className="text-sm text-slate-600 dark:text-slate-400">Visitantes</p>
              </div>
              <div className="text-center p-4 bg-orange-50 rounded-lg">
                <p className="text-2xl font-bold text-orange-600">15</p>
                <p className="text-sm text-slate-600 dark:text-slate-400">Crianças</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Botões de Ação */}
        <div className="flex gap-3 justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate('/app-ui/checkin')}
          >
            Cancelar
          </Button>
          <Button type="submit" className="bg-purple-600 hover:bg-purple-700" disabled={!selectedMember}>
            <CheckCircle2 className="w-4 h-4 mr-2" />
            Realizar Check-in
          </Button>
        </div>
      </form>
    </div>
  );
}
