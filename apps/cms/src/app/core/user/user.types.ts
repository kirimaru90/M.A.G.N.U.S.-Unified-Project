export type UserRole = 'admin' | 'player';

export interface UserDto {
  id: string;
  username: string;
  role: UserRole;
}
