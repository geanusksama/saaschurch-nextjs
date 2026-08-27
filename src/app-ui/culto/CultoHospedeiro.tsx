/**
 * Item "Hospedeiro" do menu.
 *
 * Abre direto a hierarquia ABAIXO do dirigente da hospedeira — nada de cards
 * intermediários. Ele não escolhe por onde entrar: ele quer ver as igrejas
 * dele, em verde e vermelho.
 */
import React from 'react';
import GestaoCulto from './GestaoCulto';

export default function CultoHospedeiro() {
  return <GestaoCulto escopoHospedeira />;
}
