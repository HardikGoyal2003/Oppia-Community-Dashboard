'use client'

import { redirect, usePathname } from "next/navigation";

export default function Home() {

  const pathname = usePathname();

  if(pathname.startsWith('/')){
    redirect('/dashboard')
  }

  return (
  <div>Welcome to the Home Page</div>
  );
}
