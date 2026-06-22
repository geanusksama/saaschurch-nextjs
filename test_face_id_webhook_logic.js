const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  console.log("=== INICIANDO TESTE DE INTEGRAÇÃO FACE ID ===");
  try {
    // 1. Buscar um membro ativo qualquer para servir de teste
    const member = await prisma.member.findFirst({
      where: {
        rol: { not: null },
        deletedAt: null
      },
      include: {
        church: true
      }
    });

    if (!member) {
      console.log("AVISO: Nenhum membro encontrado no banco com ROL cadastrado. Não é possível rodar o teste.");
      return;
    }

    console.log(`Membro selecionado para o teste: ROL: ${member.rol}, Nome: ${member.fullName}, Igreja: ${member.church?.name}`);

    // 2. Cadastrar um dispositivo de teste associado à mesma igreja do membro
    const testSerial = "TEST_DEVICE_999";
    const testDeviceName = "Leitor Facial Teste Integração";
    
    // Remover se já existir de algum teste anterior
    await prisma.faceidDevice.deleteMany({
      where: { serial: testSerial }
    });

    const device = await prisma.faceidDevice.create({
      data: {
        serial: testSerial,
        name: testDeviceName,
        churchId: member.churchId
      }
    });
    console.log(`Dispositivo de teste cadastrado: ID: ${device.id}, Serial: ${device.serial}`);

    // 3. Simular o Payload do ControlID
    const payload = {
      object_changes: [
        {
          object: "access_logs",
          values: {
            id: "99991",
            time: String(Math.floor(Date.now() / 1000)),
            event: "6", // Acesso Autorizado
            user_id: String(member.rol),
            portal_id: "1",
            device_id: testSerial
          }
        }
      ]
    };

    console.log("Simulando processamento do payload...");
    const obj = payload.object_changes[0];
    const values = obj.values;

    const timestamp = Number(values.time);
    const userId = Number(values.user_id);
    const deviceId = String(values.device_id);

    const timeLog = new Date(timestamp * 1000);

    // 4. Executar lógica de busca (idêntica ao Route Handler)
    console.log("Buscando dispositivo e membro no banco...");
    const matchedDevice = await prisma.faceidDevice.findUnique({
      where: { serial: deviceId },
      include: { church: true }
    });

    const matchedMember = await prisma.member.findFirst({
      where: {
        OR: [
          { rol: userId },
          { cpf: String(userId) }
        ]
      },
      include: {
        church: true,
        ecclesiasticalTitleRef: true
      }
    });

    if (!matchedMember) {
      throw new Error(`Membro não encontrado para ROL ${userId}`);
    }

    const finalChurchId = matchedDevice?.churchId || matchedMember.churchId;
    const finalChurchName = matchedDevice?.church?.name || matchedMember.church?.name || "—";
    const cargoName = matchedMember.ecclesiasticalTitleRef?.name || matchedMember.ecclesiasticalTitle || "Membro";
    const finalCampo = matchedMember.campoId || null;

    // 5. Salvar presencas
    console.log("Registrando presença...");
    const newPresence = await prisma.facePresenca.create({
      data: {
        rol: matchedMember.rol,
        nome: matchedMember.fullName,
        cargo: cargoName,
        horario: timeLog,
        confianca: 1.0,
        camera: matchedDevice?.name || `Dispositivo ${deviceId}`,
        igrejaRegional: finalChurchName,
        campo: finalCampo,
        churchId: finalChurchId
      }
    });

    console.log("Presença salva com sucesso:", {
      id: newPresence.id,
      rol: newPresence.rol,
      nome: newPresence.nome,
      horario: newPresence.horario,
      camera: newPresence.camera,
      igreja: newPresence.igrejaRegional
    });

    // 6. Limpeza
    console.log("Limpando dados de teste...");
    await prisma.facePresenca.delete({
      where: { id: newPresence.id }
    });
    await prisma.faceidDevice.delete({
      where: { id: device.id }
    });
    console.log("Limpeza concluída.");

    console.log("=== TESTE CONCLUÍDO COM SUCESSO! TODAS AS QUERIES FUNCIONARAM! ===");

  } catch (err) {
    console.error("ERRO NO TESTE:", err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
