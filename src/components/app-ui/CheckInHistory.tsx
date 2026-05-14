import { useState } from 'react';
import { Link } from 'react-router';
import { ArrowLeft, Download, Filter, Calendar, Users, TrendingUp, User, Clock, MapPin } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Badge } from '../ui/badge';

interface CheckInRecord {
  id: string;
  memberName: string;
  memberNumber: string;
  service: string;
  location: string;
  date: string;
  time: string;
  type: 'member' | 'visitor' | 'child';
  checkedInBy: string;
}

export function CheckInHistory() {
  const [dateFilter, setDateFilter] = useState('');
  const [serviceFilter, setServiceFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Mock data
  const checkIns: CheckInRecord[] = [
    {
      id: '1',
      memberName: 'João Silva Santos',
      memberNumber: '001',
      service: 'Culto de Domingo - Manhã',
      location: 'Templo Central',
      date: '2026-03-15',
      time: '09:15',
      type: 'member',
      checkedInBy: 'Auto Check-in'
    },
    {
      id: '2',
      memberName: 'Maria Oliveira Costa',
      memberNumber: '002',
      service: 'Culto de Domingo - Manhã',
      location: 'Templo Central',
      date: '2026-03-15',
      time: '09:18',
      type: 'member',
      checkedInBy: 'Recepção'
    },
    {
      id: '3',
      memberName: 'Carlos Pereira Lima',
      memberNumber: '003',
      service: 'Culto de Domingo - Manhã',
      location: 'Templo Central',
      date: '2026-03-15',
      time: '09:20',
      type: 'member',
      checkedInBy: 'Auto Check-in'
    },
    {
      id: '4',
      memberName: 'Ana Paula Souza',
      memberNumber: '004',
      service: 'Culto de Domingo - Manhã',
      location: 'Templo Central',
      date: '2026-03-15',
      time: '09:22',
      type: 'member',
      checkedInBy: 'Recepção'
    },
    {
      id: '5',
      memberName: 'Pedro Visitante',
      memberNumber: 'V-001',
      service: 'Culto de Domingo - Manhã',
      location: 'Templo Central',
      date: '2026-03-15',
      time: '09:25',
      type: 'visitor',
      checkedInBy: 'Recepção'
    },
    {
      id: '6',
      memberName: 'Lucas Henrique (8 anos)',
      memberNumber: 'C-001',
      service: 'Culto de Domingo - Manhã',
      location: 'Ministério Infantil',
      date: '2026-03-15',
      time: '09:10',
      type: 'child',
      checkedInBy: 'Tia Paula'
    },
    {
      id: '7',
      memberName: 'Fernanda Lima Santos',
      memberNumber: '005',
      service: 'Culto de Oração - Quarta',
      location: 'Templo Central',
      date: '2026-03-13',
      time: '19:35',
      type: 'member',
      checkedInBy: 'Auto Check-in'
    },
    {
      id: '8',
      memberName: 'Roberto Costa Silva',
      memberNumber: '006',
      service: 'Culto de Oração - Quarta',
      location: 'Templo Central',
      date: '2026-03-13',
      time: '19:40',
      type: 'member',
      checkedInBy: 'Recepção'
    },
  ];

  const filteredCheckIns = checkIns.filter(checkIn => {
    const matchesDate = !dateFilter || checkIn.date === dateFilter;
    const matchesService = serviceFilter === 'all' || checkIn.service.includes(serviceFilter);
    const matchesType = typeFilter === 'all' || checkIn.type === typeFilter;
    const matchesSearch = !searchTerm || 
      checkIn.memberName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      checkIn.memberNumber.toLowerCase().includes(searchTerm.toLowerCase());
    
    return matchesDate && matchesService && matchesType && matchesSearch;
  });

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'member':
        return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-200">Membro</Badge>;
      case 'visitor':
        return <Badge className="bg-purple-100 text-purple-700 hover:bg-purple-200">Visitante</Badge>;
      case 'child':
        return <Badge className="bg-green-100 text-green-700 hover:bg-green-200">Criança</Badge>;
      default:
        return <Badge variant="secondary">{type}</Badge>;
    }
  };

  const stats = {
    total: filteredCheckIns.length,
    members: filteredCheckIns.filter(c => c.type === 'member').length,
    visitors: filteredCheckIns.filter(c => c.type === 'visitor').length,
    children: filteredCheckIns.filter(c => c.type === 'child').length,
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Histórico de Check-ins</h1>
            <p className="text-slate-600 dark:text-slate-400">Visualizar e exportar histórico de check-ins</p>
          </div>
          <Button className="bg-green-600 hover:bg-green-700">
            <Download className="w-4 h-4 mr-2" />
            Exportar Relatório
          </Button>
        </div>
      </div>

      {/* Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 dark:text-slate-400">Total de Check-ins</p>
                <p className="text-2xl font-bold text-slate-900">{stats.total}</p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                <Users className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 dark:text-slate-400">Membros</p>
                <p className="text-2xl font-bold text-slate-900">{stats.members}</p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                <User className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 dark:text-slate-400">Visitantes</p>
                <p className="text-2xl font-bold text-slate-900">{stats.visitors}</p>
              </div>
              <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 dark:text-slate-400">Crianças</p>
                <p className="text-2xl font-bold text-slate-900">{stats.children}</p>
              </div>
              <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
                <Users className="w-6 h-6 text-orange-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="w-5 h-5" />
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label htmlFor="search">Buscar</Label>
              <Input
                id="search"
                placeholder="Nome ou número..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="date">Data</Label>
              <Input
                id="date"
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="service">Culto/Evento</Label>
              <Select value={serviceFilter} onValueChange={setServiceFilter}>
                <SelectTrigger id="service">
                  <SelectValue placeholder="Todos os cultos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os cultos</SelectItem>
                  <SelectItem value="Domingo - Manhã">Domingo - Manhã</SelectItem>
                  <SelectItem value="Domingo - Noite">Domingo - Noite</SelectItem>
                  <SelectItem value="Oração - Quarta">Oração - Quarta</SelectItem>
                  <SelectItem value="Jovens - Sexta">Jovens - Sexta</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="type">Tipo</Label>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger id="type">
                  <SelectValue placeholder="Todos os tipos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os tipos</SelectItem>
                  <SelectItem value="member">Membros</SelectItem>
                  <SelectItem value="visitor">Visitantes</SelectItem>
                  <SelectItem value="child">Crianças</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabela de Check-ins */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Registros de Check-in
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Número</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Culto/Evento</TableHead>
                  <TableHead>Local</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Horário</TableHead>
                  <TableHead>Registrado por</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCheckIns.length > 0 ? (
                  filteredCheckIns.map((checkIn) => (
                    <TableRow key={checkIn.id}>
                      <TableCell className="font-medium">{checkIn.memberName}</TableCell>
                      <TableCell>{checkIn.memberNumber}</TableCell>
                      <TableCell>{getTypeBadge(checkIn.type)}</TableCell>
                      <TableCell className="text-sm">{checkIn.service}</TableCell>
                      <TableCell className="text-sm flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-slate-400" />
                        {checkIn.location}
                      </TableCell>
                      <TableCell className="text-sm">
                        {new Date(checkIn.date).toLocaleDateString('pt-BR')}
                      </TableCell>
                      <TableCell className="text-sm flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-400" />
                        {checkIn.time}
                      </TableCell>
                      <TableCell className="text-sm text-slate-600">{checkIn.checkedInBy}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-slate-500">
                      Nenhum check-in encontrado com os filtros selecionados
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
