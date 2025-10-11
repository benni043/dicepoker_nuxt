export interface DataColumn {
  ones: number;
  twos: number;
  threes: number;
  fours: number;
  fives: number;
  sixes: number;
  fullHouse: number;
  street: number;
  poker: number;
  grande: number;
  doubleGrande: number;
}

export interface DataColumnPlayer {
  player: Player;
  dataColumns: DataColumn[];
}

export interface Player {
  uuid: string;
  name: string;
}
