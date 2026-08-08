import { SubscriptionPlan, LoyaltyReward } from '../types';

export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: 'plan_silver',
    title: 'Plano Barba & Estilo',
    monthly_price: 89.00,
    description: 'Manutenção semanal da barba e acabamentos no pescoço/pezinho.',
    features: [
      'Barba ilimitada no mês',
      'Acabamento (pezinho) ilimitado',
      '10% OFF em produtos e cosméticos',
      'Bebida cortesia na chegada'
    ]
  },
  {
    id: 'plan_gold',
    title: 'Plano Corte Ilimitado VIP',
    monthly_price: 119.00,
    description: 'Cortes de cabelo ilimitados e prioridade absoluta no agendamento.',
    is_popular: true,
    badge: 'Mais Vendido',
    features: [
      'Cortes de cabelo ILIMITADOS',
      'Lavagem com shampoo premium em todas as sessões',
      'Agendamento prioritário no app',
      '15% OFF em barboterapia e químicas',
      '1 Cerveja Artesanal / Café por visita'
    ]
  },
  {
    id: 'plan_black',
    title: 'Clube Barão All-Inclusive',
    monthly_price: 189.00,
    description: 'A experiência definitiva sem preocupação com custos avulsos.',
    badge: 'Experiência Completa',
    features: [
      'Corte de cabelo ILIMITADO',
      'Barboterapia ILIMITADA',
      'Sobrancelha inclusa sem custo adicional',
      '20% OFF para dependentes/amigos',
      'Open Bar da casa (Cerveja, Whisky, Café gourmet)'
    ]
  }
];

export const DEFAULT_USER_SUBSCRIPTION = {
  id: 'sub_99218',
  plan_id: 'plan_gold',
  plan_title: 'Plano Corte Ilimitado VIP',
  monthly_price: 119.00,
  status: 'active',
  next_billing_date: '2026-08-15',
  cuts_used_this_month: 0,
  cuts_limit: 'ilimitado'
};

export const LOYALTY_REWARDS: LoyaltyReward[] = [
  {
    id: 'rew_1',
    title: 'Cupom R$ 20,00 OFF no Próximo Serviço',
    points_required: 200,
    reward_type: 'discount',
    value_description: 'Desconto direto no agendamento',
    icon: 'Tag'
  },
  {
    id: 'rew_2',
    title: 'Pomada Modeladora Matte Navo Premium',
    points_required: 350,
    reward_type: 'free_product',
    value_description: 'Retire na recepção da barbearia',
    icon: 'Package'
  },
  {
    id: 'rew_3',
    title: 'Barboterapia Imperial Grátis',
    points_required: 500,
    reward_type: 'free_service',
    value_description: 'Serviço 100% gratuito adicionado ao agendamento',
    icon: 'Gift'
  }
];
