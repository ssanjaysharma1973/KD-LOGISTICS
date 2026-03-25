import socket
import threading
import sys

LISTEN_HOST = '127.0.0.1'
LISTEN_PORT = 8501
TARGET_HOST = '127.0.0.1'
TARGET_PORT = 8503

BUFFER_SIZE = 4096


def forward(src, dst):
    try:
        while True:
            data = src.recv(BUFFER_SIZE)
            if not data:
                break
            dst.sendall(data)
    except Exception:
        pass
    finally:
        try:
            src.shutdown(socket.SHUT_RD)
        except Exception:
            pass


def handle_client(client_sock, client_addr):
    print(f"Connection from {client_addr}")
    try:
        upstream = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        upstream.connect((TARGET_HOST, TARGET_PORT))
    except Exception as e:
        print(f"Failed to connect to upstream {TARGET_HOST}:{TARGET_PORT}: {e}")
        client_sock.close()
        return

    t1 = threading.Thread(target=forward, args=(client_sock, upstream), daemon=True)
    t2 = threading.Thread(target=forward, args=(upstream, client_sock), daemon=True)
    t1.start()
    t2.start()

    t1.join()
    t2.join()

    try:
        client_sock.close()
    except Exception:
        pass
    try:
        upstream.close()
    except Exception:
        pass

    print(f"Connection closed {client_addr}")


def main():
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    try:
        s.bind((LISTEN_HOST, LISTEN_PORT))
    except Exception as e:
        print(f"Failed to bind {LISTEN_HOST}:{LISTEN_PORT}: {e}")
        sys.exit(1)
    s.listen(100)
    print(f"Proxy listening on {LISTEN_HOST}:{LISTEN_PORT} -> {TARGET_HOST}:{TARGET_PORT}")
    try:
        while True:
            client_sock, client_addr = s.accept()
            th = threading.Thread(target=handle_client, args=(client_sock, client_addr), daemon=True)
            th.start()
    except KeyboardInterrupt:
        print("Stopping proxy")
    finally:
        try:
            s.close()
        except Exception:
            pass


if __name__ == '__main__':
    main()
